mod commands;
mod cleanvoice;
mod db;
mod ffmpeg;
mod claude;
mod models;
mod podbean;
mod youtube;

use std::borrow::Cow;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

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
            eprintln!("[media protocol] raw URI: {}", uri);

            // Extract path portion: find "localhost/" and take everything after it
            let raw_path = uri
                .find("localhost/")
                .map(|i| &uri[i + "localhost/".len()..])
                .unwrap_or("");

            // Strip query string and fragment if present
            let raw_path = raw_path.split('?').next().unwrap_or(raw_path);
            let raw_path = raw_path.split('#').next().unwrap_or(raw_path);

            let file_path = percent_decode(raw_path);
            eprintln!("[media protocol] resolved path: {}", file_path);

            let Ok(metadata) = std::fs::metadata(&file_path) else {
                eprintln!("[media protocol] 404 not found: {}", file_path);
                return tauri::http::Response::builder()
                    .status(404)
                    .body(Cow::Borrowed(&[] as &[u8]))
                    .unwrap();
            };

            let total_size = metadata.len();
            let mime = guess_mime(&file_path);

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
                let start: u64 = parts[0].parse().unwrap_or(0);
                let end: u64 = if parts.len() > 1 && !parts[1].is_empty() {
                    parts[1].parse().unwrap_or(total_size - 1)
                } else {
                    // Serve up to 1MB at a time for range requests
                    std::cmp::min(start + 1024 * 1024 - 1, total_size - 1)
                };

                let length = end - start + 1;
                let mut file = match File::open(&file_path) {
                    Ok(f) => f,
                    Err(_) => {
                        return tauri::http::Response::builder()
                            .status(500)
                            .body(Cow::Borrowed(&[] as &[u8]))
                            .unwrap();
                    }
                };

                let _ = file.seek(SeekFrom::Start(start));
                let mut buf = vec![0u8; length as usize];
                let _ = file.read_exact(&mut buf);

                tauri::http::Response::builder()
                    .status(206)
                    .header("Content-Type", mime)
                    .header("Content-Length", length.to_string())
                    .header(
                        "Content-Range",
                        format!("bytes {}-{}/{}", start, end, total_size),
                    )
                    .header("Accept-Ranges", "bytes")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Cow::Owned(buf))
                    .unwrap()
            } else {
                // Full file request — for small files or initial metadata load
                let mut file = match File::open(&file_path) {
                    Ok(f) => f,
                    Err(_) => {
                        return tauri::http::Response::builder()
                            .status(500)
                            .body(Cow::Borrowed(&[] as &[u8]))
                            .unwrap();
                    }
                };

                let mut buf = Vec::with_capacity(total_size as usize);
                let _ = file.read_to_end(&mut buf);

                tauri::http::Response::builder()
                    .status(200)
                    .header("Content-Type", mime)
                    .header("Content-Length", total_size.to_string())
                    .header("Accept-Ranges", "bytes")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Cow::Owned(buf))
                    .unwrap()
            }
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .build(),
        )
        .setup(|app| {
            // Initialize the database on first launch
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = db::initialize(&app_handle).await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Episode commands
            commands::episodes::create_episode,
            commands::episodes::get_episode,
            commands::episodes::list_episodes,
            commands::episodes::update_episode,
            commands::episodes::delete_episode,
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
