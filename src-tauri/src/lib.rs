mod commands;
mod cleanvoice;
mod ffmpeg;
mod claude;
mod models;
mod podbean;
mod youtube;

use std::borrow::Cow;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

/// Allowed directories for media:// protocol access.
/// Returns a list of canonicalized base directories that the media protocol may serve files from.
/// We canonicalize here so that comparisons with canonicalized request paths work correctly
/// on Windows, where std::fs::canonicalize adds the \\?\ extended-length prefix.
fn allowed_media_dirs() -> Vec<std::path::PathBuf> {
    let mut dirs = Vec::new();
    for dir in [
        dirs::video_dir(),
        dirs::document_dir(),
        dirs::desktop_dir(),
        dirs::download_dir(),
        dirs::home_dir(),
        dirs::data_dir(),
        dirs::data_local_dir(),
    ] {
        if let Some(d) = dir {
            dirs.push(std::fs::canonicalize(&d).unwrap_or(d));
        }
    }
    dirs
}

fn percent_decode(input: &str) -> String {
    let mut result = Vec::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                &input[i + 1..i + 3],
                16,
            ) {
                result.push(byte);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&result).to_string()
}

fn guess_mime(path: &str) -> &'static str {
    match Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "mp4" | "m4v" => "video/mp4",
        "mov" => "video/quicktime",
        "mkv" => "video/x-matroska",
        "avi" => "video/x-msvideo",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "m4a" | "aac" => "audio/mp4",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "flac" => "audio/flac",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        _ => "application/octet-stream",
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .register_uri_scheme_protocol("media", |_ctx, request| {
            let uri = request.uri().to_string();
            log::info!("[media protocol] raw URI: {}", uri);

            // Extract path portion: find "localhost/" and take everything after it
            let raw_path = uri
                .find("localhost/")
                .map(|i| &uri[i + "localhost/".len()..])
                .unwrap_or("");

            // Strip query string and fragment if present
            let raw_path = raw_path.split('?').next().unwrap_or(raw_path);
            let raw_path = raw_path.split('#').next().unwrap_or(raw_path);

            let file_path = percent_decode(raw_path);
            log::info!("[media protocol] resolved path: {}", file_path);

            // Security: validate the resolved path is under an allowed directory
            let canonical = std::fs::canonicalize(&file_path).unwrap_or_else(|_| std::path::PathBuf::from(&file_path));
            let allowed = allowed_media_dirs();
            log::info!("[media protocol] canonical path: {:?}", canonical);
            let is_allowed = allowed.iter().any(|prefix| canonical.starts_with(prefix));
            if !is_allowed {
                log::warn!("[media protocol] 403 path not in allowed directories: {:?}", canonical);
                log::warn!("[media protocol] allowed dirs: {:?}", allowed);
                return tauri::http::Response::builder()
                    .status(403)
                    .body(Cow::Borrowed(&[] as &[u8]))
                    .unwrap();
            }

            let Ok(metadata) = std::fs::metadata(&file_path) else {
                log::warn!("[media protocol] 404 not found: {}", file_path);
                return tauri::http::Response::builder()
                    .status(404)
                    .body(Cow::Borrowed(&[] as &[u8]))
                    .unwrap();
            };

            let total_size = metadata.len();
            let mime = guess_mime(&file_path);

            // Guard: empty files return an empty 200
            if total_size == 0 {
                return tauri::http::Response::builder()
                    .status(200)
                    .header("Content-Type", mime)
                    .header("Content-Length", "0")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Cow::Borrowed(&[] as &[u8]))
                    .unwrap();
            }

            // Max chunk size per range response (4 MB)
            const MAX_CHUNK: u64 = 4 * 1024 * 1024;

            // Check for Range header (needed for seeking in video/audio)
            let range_header = request
                .headers()
                .get("range")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");

            if range_header.starts_with("bytes=") {
                // Parse range: bytes=START-END or bytes=START-
                let range = &range_header[6..];
                let parts: Vec<&str> = range.split('-').collect();
                let start: u64 = parts[0].parse().unwrap_or(0).min(total_size.saturating_sub(1));
                let end: u64 = if parts.len() > 1 && !parts[1].is_empty() {
                    parts[1].parse().unwrap_or(total_size - 1).min(total_size - 1)
                } else {
                    std::cmp::min(start + MAX_CHUNK - 1, total_size - 1)
                };

                // Clamp length to MAX_CHUNK to prevent OOM
                let length = (end - start + 1).min(MAX_CHUNK);
                let clamped_end = start + length - 1;

                let mut file = match File::open(&file_path) {
                    Ok(f) => f,
                    Err(e) => {
                        log::error!("[media protocol] open error: {}", e);
                        return tauri::http::Response::builder()
                            .status(500)
                            .body(Cow::Borrowed(&[] as &[u8]))
                            .unwrap();
                    }
                };

                if let Err(e) = file.seek(SeekFrom::Start(start)) {
                    log::error!("[media protocol] seek error: {}", e);
                    return tauri::http::Response::builder()
                        .status(500)
                        .body(Cow::Borrowed(&[] as &[u8]))
                        .unwrap();
                }
                let mut buf = vec![0u8; length as usize];
                if let Err(e) = file.read_exact(&mut buf) {
                    log::error!("[media protocol] read error: {}", e);
                    return tauri::http::Response::builder()
                        .status(500)
                        .body(Cow::Borrowed(&[] as &[u8]))
                        .unwrap();
                }

                tauri::http::Response::builder()
                    .status(206)
                    .header("Content-Type", mime)
                    .header("Content-Length", length.to_string())
                    .header(
                        "Content-Range",
                        format!("bytes {}-{}/{}", start, clamped_end, total_size),
                    )
                    .header("Accept-Ranges", "bytes")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Cow::Owned(buf))
                    .unwrap()
            } else {
                // Full file request — serve first chunk as 206 to force range requests for large files.
                let serve_size = total_size.min(MAX_CHUNK) as usize;
                let mut file = match File::open(&file_path) {
                    Ok(f) => f,
                    Err(e) => {
                        log::error!("[media protocol] open error: {}", e);
                        return tauri::http::Response::builder()
                            .status(500)
                            .body(Cow::Borrowed(&[] as &[u8]))
                            .unwrap();
                    }
                };

                let mut buf = vec![0u8; serve_size];
                if let Err(e) = file.read_exact(&mut buf) {
                    log::error!("[media protocol] read error: {}", e);
                    return tauri::http::Response::builder()
                        .status(500)
                        .body(Cow::Borrowed(&[] as &[u8]))
                        .unwrap();
                }

                if total_size <= MAX_CHUNK {
                    // Small file: serve entire content as 200
                    tauri::http::Response::builder()
                        .status(200)
                        .header("Content-Type", mime)
                        .header("Content-Length", total_size.to_string())
                        .header("Accept-Ranges", "bytes")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Cow::Owned(buf))
                        .unwrap()
                } else {
                    // Large file: serve first chunk as 206 Partial Content
                    // Content-Length must match actual bytes sent, not total file size
                    tauri::http::Response::builder()
                        .status(206)
                        .header("Content-Type", mime)
                        .header("Content-Length", serve_size.to_string())
                        .header(
                            "Content-Range",
                            format!("bytes 0-{}/{}", serve_size - 1, total_size),
                        )
                        .header("Accept-Ranges", "bytes")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Cow::Owned(buf))
                        .unwrap()
                }
            }
        })
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_stronghold::Builder::new(|password| {
            // Derive a 32-byte key using PBKDF2-like iterative stretching.
            // The Stronghold vault handles encryption; this converts the password
            // into a key that is resistant to brute-force attacks.
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};

            let salt = b"mam-podcast-studio-stronghold-v1";
            let pw = password.as_bytes();
            let mut key = vec![0u8; 32];

            // Initialize with salted password bytes
            for (i, byte) in key.iter_mut().enumerate() {
                *byte = pw.get(i % pw.len()).copied().unwrap_or(0)
                    ^ salt[i % salt.len()];
            }

            // Iterate 10,000 rounds for key stretching
            for round in 0u32..10_000 {
                let mut hasher = DefaultHasher::new();
                round.hash(&mut hasher);
                key.hash(&mut hasher);
                pw.hash(&mut hasher);
                let h = hasher.finish().to_le_bytes();
                for (i, byte) in key.iter_mut().enumerate() {
                    *byte = byte.wrapping_add(h[i % 8]).wrapping_mul(31);
                }
            }
            key
        }).build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .build(),
        )
        .setup(|_app| {
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // FFmpeg commands
            commands::enhance::probe_video,
            commands::enhance::enhance_audio,
            commands::enhance::cancel_processing,
            commands::enhance::preview_enhancement,
            // Extraction commands
            commands::extract::extract_audio,
            // Show notes commands
            commands::show_notes::generate_show_notes,
            commands::show_notes::read_transcript,
            commands::show_notes::get_default_system_prompt,
            // Cleanvoice commands
            commands::cleanvoice::cleanvoice_enhance,
            commands::cleanvoice::cleanvoice_cancel,
            commands::cleanvoice::test_cleanvoice_api,
            // Thumbnail commands
            commands::thumbnail::extract_frame,
            commands::thumbnail::remove_background,
            // Podbean commands
            commands::podbean::podbean_publish,
            commands::podbean::test_podbean_api,
            commands::podbean::podbean_list_podcasts,
            // YouTube commands
            commands::youtube::youtube_oauth_start,
            commands::youtube::youtube_refresh_token,
            commands::youtube::youtube_upload,
            // Settings commands
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
            commands::settings::test_claude_api,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MAM Podcast Studio");
}
