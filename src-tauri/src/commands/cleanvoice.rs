use crate::cleanvoice::{CleanvoiceClient, CleanvoiceProgress, EditConfig};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;

// Track cancellation flag
static CANCELLED: std::sync::LazyLock<Arc<Mutex<bool>>> =
    std::sync::LazyLock::new(|| Arc::new(Mutex::new(false)));

#[derive(serde::Deserialize, Debug)]
pub struct CleanvoiceEnhanceRequest {
    pub api_key: String,
    pub input_path: String,
    pub output_path: String,
    // ── Audio cleaning options ──
    pub fillers: Option<bool>,
    pub long_silences: Option<bool>,
    pub mouth_sounds: Option<bool>,
    pub breath: Option<serde_json::Value>,
    pub stutters: Option<bool>,
    pub hesitations: Option<bool>,
    pub muted: Option<bool>,
    // ── Audio enhancement options ──
    pub remove_noise: Option<bool>,
    pub studio_sound: Option<serde_json::Value>,
    pub normalize: Option<bool>,
    // ── Output options ──
    pub export_format: Option<String>,
    pub target_lufs: Option<f64>,
    // ── Content generation ──
    pub transcription: Option<bool>,
    pub summarize: Option<bool>,
}

/// Extract audio from video (copy codec, no re-encoding) using FFmpeg sidecar
async fn extract_audio_from_video(
    app: &AppHandle,
    input_path: &str,
    output_path: &str,
) -> Result<(), String> {
    let args = vec![
        "-y",
        "-i", input_path,
        "-vn",           // No video
        "-acodec", "copy", // Copy audio codec (no re-encoding)
        output_path,
    ];

    let output = app
        .shell()
        .sidecar("ffmpeg")
        .expect("failed to create ffmpeg sidecar")
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to extract audio: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg audio extraction failed: {}", stderr));
    }

    Ok(())
}

/// Mux enhanced audio back into original video (no re-encoding)
async fn mux_audio_into_video(
    app: &AppHandle,
    video_path: &str,
    audio_path: &str,
    output_path: &str,
) -> Result<(), String> {
    let args = vec![
        "-y",
        "-i", video_path,
        "-i", audio_path,
        "-c:v", "copy",   // Copy video codec
        "-c:a", "copy",   // Copy audio codec
        "-map", "0:v:0",  // Video from first input
        "-map", "1:a:0",  // Audio from second input
        output_path,
    ];

    let output = app
        .shell()
        .sidecar("ffmpeg")
        .expect("failed to create ffmpeg sidecar")
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to mux audio: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg mux failed: {}", stderr));
    }

    Ok(())
}

#[tauri::command]
pub async fn cleanvoice_enhance(
    app: AppHandle,
    request: CleanvoiceEnhanceRequest,
) -> Result<String, String> {
    // Reset cancellation flag
    {
        let mut cancelled = CANCELLED.lock().unwrap();
        *cancelled = false;
    }

    eprintln!("[Cleanvoice] Starting enhancement for: {}", request.input_path);

    let client = CleanvoiceClient::new(&request.api_key);
    let input_path = PathBuf::from(&request.input_path);
    let output_path = PathBuf::from(&request.output_path);

    // Build the config from request
    let mut config = EditConfig {
        fillers: request.fillers,
        long_silences: request.long_silences,
        mouth_sounds: request.mouth_sounds,
        breath: request.breath.clone(),
        stutters: request.stutters,
        hesitations: request.hesitations,
        muted: request.muted,
        remove_noise: request.remove_noise,
        studio_sound: request.studio_sound.clone(),
        normalize: request.normalize,
        keep_music: None,
        export_format: request.export_format.clone(),
        target_lufs: request.target_lufs,
        transcription: request.transcription,
        summarize: request.summarize,
        video: None, // Set below based on routing
    };

    // Determine if input is a video file
    let input_ext = input_path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let is_video = matches!(input_ext.as_str(), "mp4" | "mov" | "mkv" | "avi" | "webm");

    // Smart routing per Cleanvoice docs:
    // - Editing features (fillers, stutters, etc.) → send video, video: true
    // - Enhancement only (noise, studio_sound, normalize) → extract audio, process, mux back
    let has_editing = config.has_editing_features();

    let (file_to_upload, needs_mux) = if is_video && !has_editing {
        // Enhancement-only: extract audio first (10-50x smaller upload)
        let _ = app.emit("cleanvoice-progress", &CleanvoiceProgress {
            stage: "extract".to_string(),
            message: "Extracting audio from video (faster upload)...".to_string(),
            percent: 1.0,
        });

        // Determine audio extension from the source
        let temp_audio = output_path
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .join("_cleanvoice_temp_audio.aac");

        extract_audio_from_video(
            &app,
            &request.input_path,
            &temp_audio.to_string_lossy(),
        )
        .await?;

        eprintln!("[Cleanvoice] Audio extracted to: {}", temp_audio.display());
        (temp_audio, true) // Will need to mux back after
    } else if is_video && has_editing {
        // Editing features: send the video directly
        config.video = Some(true);
        eprintln!("[Cleanvoice] Sending video directly (editing features enabled)");
        (input_path.clone(), false) // Cleanvoice returns edited video
    } else {
        // Already an audio file
        eprintln!("[Cleanvoice] Input is already audio");
        (input_path.clone(), false)
    };

    // Check cancellation
    {
        let cancelled = CANCELLED.lock().unwrap();
        if *cancelled {
            return Err("Processing cancelled".to_string());
        }
    }

    // Determine the output path for Cleanvoice result
    let cleanvoice_output = if needs_mux {
        // Download enhanced audio to temp file, then mux
        output_path
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .join("_cleanvoice_temp_enhanced.aac")
    } else {
        output_path.clone()
    };

    // Run the Cleanvoice pipeline
    let app_clone = app.clone();
    let result = client
        .enhance(&file_to_upload, &cleanvoice_output, config, move |progress: CleanvoiceProgress| {
            // Check cancellation
            {
                let cancelled = CANCELLED.lock().unwrap();
                if *cancelled {
                    return;
                }
            }
            let _ = app_clone.emit("cleanvoice-progress", &progress);
        })
        .await
        .map_err(|e| {
            let cancelled = CANCELLED.lock().unwrap();
            if *cancelled {
                return "Processing cancelled".to_string();
            }
            e.to_string()
        })?;

    // If we extracted audio, mux it back into the original video
    if needs_mux {
        let _ = app.emit("cleanvoice-progress", &CleanvoiceProgress {
            stage: "mux".to_string(),
            message: "Muxing enhanced audio back into video...".to_string(),
            percent: 96.0,
        });

        mux_audio_into_video(
            &app,
            &request.input_path,
            &cleanvoice_output.to_string_lossy(),
            &output_path.to_string_lossy(),
        )
        .await?;

        // Clean up temp files
        let temp_audio = output_path
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .join("_cleanvoice_temp_audio.aac");
        let _ = tokio::fs::remove_file(&temp_audio).await;
        let _ = tokio::fs::remove_file(&cleanvoice_output).await;

        let _ = app.emit("cleanvoice-progress", &CleanvoiceProgress {
            stage: "done".to_string(),
            message: "Enhancement complete".to_string(),
            percent: 100.0,
        });
    }

    // Clean up temp audio extraction if it exists
    if is_video && !has_editing {
        let temp_audio = output_path
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .join("_cleanvoice_temp_audio.aac");
        let _ = tokio::fs::remove_file(&temp_audio).await;
    }

    // Emit stats if available
    if let Some(ref edit_result) = result.result {
        let _ = app.emit("cleanvoice-stats", edit_result);
    }

    Ok(request.output_path)
}

#[tauri::command]
pub async fn cleanvoice_cancel() -> Result<(), String> {
    let mut cancelled = CANCELLED.lock().unwrap();
    *cancelled = true;
    Ok(())
}

#[tauri::command]
pub async fn test_cleanvoice_api(api_key: String) -> Result<serde_json::Value, String> {
    let client = CleanvoiceClient::new(&api_key);
    let auth = client
        .test_connection()
        .await
        .map_err(|e| e.to_string())?;

    // Return the auth info (email, credits) as JSON
    serde_json::to_value(&auth).map_err(|e| e.to_string())
}
