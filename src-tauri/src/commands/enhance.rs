use crate::ffmpeg;
use crate::models::{EnhancementPreset, VideoProbeResult};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;

// Global handle to the current FFmpeg process for cancellation
static CURRENT_PROCESS: std::sync::LazyLock<Arc<Mutex<Option<u32>>>> =
    std::sync::LazyLock::new(|| Arc::new(Mutex::new(None)));

#[tauri::command]
pub async fn probe_video(
    app: AppHandle,
    video_path: String,
) -> Result<VideoProbeResult, String> {
    ffmpeg::probe_video(&app, &video_path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn enhance_audio(
    app: AppHandle,
    input_path: String,
    output_path: String,
    preset: String,
    total_duration: f64,
) -> Result<String, String> {
    let enhancement_preset = match preset.as_str() {
        "light" => EnhancementPreset::light(),
        "heavy" => EnhancementPreset::heavy(),
        _ => EnhancementPreset::standard(),
    };

    let filter_chain = ffmpeg::build_filter_chain(&enhancement_preset);

    // Build FFmpeg command: extract audio, process, mux back
    let args = vec![
        "-y".to_string(),
        "-i".to_string(),
        input_path.clone(),
        "-af".to_string(),
        filter_chain,
        "-c:v".to_string(),
        "copy".to_string(),
        "-progress".to_string(),
        "pipe:1".to_string(),
        output_path.clone(),
    ];

    let (mut rx, child) = app
        .shell()
        .sidecar("ffmpeg")
        .expect("failed to create ffmpeg sidecar")
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;

    // Store PID for cancellation
    {
        let mut proc = CURRENT_PROCESS.lock().unwrap();
        *proc = Some(child.pid());
    }

    // Read output for progress
    use tauri_plugin_shell::process::CommandEvent;
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                let line_str = String::from_utf8_lossy(&line);
                if let Some(progress) = ffmpeg::parse_progress(&line_str, total_duration) {
                    let _ = app.emit("enhancement-progress", &progress);
                }
            }
            CommandEvent::Stderr(line) => {
                let line_str = String::from_utf8_lossy(&line);
                if let Some(progress) = ffmpeg::parse_progress(&line_str, total_duration) {
                    let _ = app.emit("enhancement-progress", &progress);
                }
            }
            CommandEvent::Terminated(status) => {
                // Check if this was a cancellation (PID already cleared by cancel_processing)
                let was_cancelled = {
                    let mut proc = CURRENT_PROCESS.lock().unwrap();
                    let cancelled = proc.is_none();
                    *proc = None;
                    cancelled
                };

                if status.code == Some(0) {
                    return Ok(output_path);
                } else if was_cancelled {
                    // Clean up partial output file
                    let _ = std::fs::remove_file(&output_path);
                    return Err("Processing cancelled".to_string());
                } else {
                    return Err(format!(
                        "FFmpeg exited with code: {:?}",
                        status.code
                    ));
                }
            }
            _ => {}
        }
    }

    Err("FFmpeg process ended unexpectedly".to_string())
}

#[tauri::command]
pub async fn cancel_processing() -> Result<(), String> {
    let pid = {
        let mut proc = CURRENT_PROCESS.lock().unwrap();
        proc.take()
    };

    if let Some(pid) = pid {
        // Kill the FFmpeg process tree
        #[cfg(target_os = "windows")]
        {
            // On Windows, use taskkill to kill the process and its children
            let _ = std::process::Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .output();
        }

        #[cfg(not(target_os = "windows"))]
        {
            // On macOS/Linux, send SIGKILL
            let _ = std::process::Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output();
        }

        Ok(())
    } else {
        Err("No active processing to cancel".to_string())
    }
}

#[tauri::command]
pub async fn preview_enhancement(
    app: AppHandle,
    input_path: String,
    output_path: String,
    preset: String,
    start_seconds: f64,
    duration_seconds: f64,
) -> Result<String, String> {
    let enhancement_preset = match preset.as_str() {
        "light" => EnhancementPreset::light(),
        "heavy" => EnhancementPreset::heavy(),
        _ => EnhancementPreset::standard(),
    };

    let filter_chain = ffmpeg::build_filter_chain(&enhancement_preset);

    let args = vec![
        "-y".to_string(),
        "-ss".to_string(),
        start_seconds.to_string(),
        "-t".to_string(),
        duration_seconds.to_string(),
        "-i".to_string(),
        input_path,
        "-af".to_string(),
        filter_chain,
        "-c:v".to_string(),
        "copy".to_string(),
        output_path.clone(),
    ];

    let output = app
        .shell()
        .sidecar("ffmpeg")
        .expect("failed to create ffmpeg sidecar")
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to run FFmpeg preview: {}", e))?;

    if output.status.success() {
        Ok(output_path)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("FFmpeg preview failed: {}", stderr))
    }
}
