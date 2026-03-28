use crate::ffmpeg;
use crate::models::{EnhancementPreset, VideoProbeResult};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;

// Track active FFmpeg processes by job ID for per-job cancellation
static ACTIVE_PROCESSES: std::sync::LazyLock<Arc<Mutex<HashMap<String, u32>>>> =
    std::sync::LazyLock::new(|| Arc::new(Mutex::new(HashMap::new())));

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
        .map_err(|e| format!("FFmpeg binary not found. Please reinstall the app: {}", e))?
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg: {}", e))?;

    // Store PID for cancellation using output_path as job ID
    let job_id = output_path.clone();
    {
        let mut procs = ACTIVE_PROCESSES.lock().unwrap_or_else(|e| e.into_inner());
        procs.insert(job_id.clone(), child.pid());
    }

    // Read output for progress
    use tauri_plugin_shell::process::CommandEvent;
    let mut progress_acc = ffmpeg::ProgressAccumulator::default();
    let mut last_stderr_lines: Vec<String> = Vec::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                let line_str = String::from_utf8_lossy(&line);
                // -progress pipe:1 sends one key=value per line
                for sub_line in line_str.lines() {
                    if let Some(progress) = progress_acc.feed(sub_line, total_duration) {
                        let _ = app.emit("enhancement-progress", &progress);
                    }
                }
            }
            CommandEvent::Stderr(line) => {
                let line_str = String::from_utf8_lossy(&line).to_string();
                log::info!("[FFmpeg] {}", line_str);
                // Keep last 10 stderr lines for error reporting
                last_stderr_lines.push(line_str.clone());
                if last_stderr_lines.len() > 10 {
                    last_stderr_lines.remove(0);
                }
                // Also check stderr for the single-line progress format
                if let Some(progress) = ffmpeg::parse_progress_stderr(&line_str, total_duration) {
                    let _ = app.emit("enhancement-progress", &progress);
                }
            }
            CommandEvent::Terminated(status) => {
                // Check if this was a cancellation (PID already cleared by cancel_processing)
                let was_cancelled = {
                    let mut procs = ACTIVE_PROCESSES.lock().unwrap_or_else(|e| e.into_inner());
                    let cancelled = !procs.contains_key(&job_id);
                    procs.remove(&job_id);
                    cancelled
                };

                if status.code == Some(0) {
                    return Ok(output_path);
                } else if was_cancelled {
                    // Clean up partial output file
                    let _ = std::fs::remove_file(&output_path);
                    return Err("Processing cancelled".to_string());
                } else {
                    let stderr_tail = last_stderr_lines.join("\n");
                    return Err(format!(
                        "FFmpeg exited with code {:?}:\n{}",
                        status.code, stderr_tail
                    ));
                }
            }
            _ => {}
        }
    }

    // Clean up process slot if loop exits without Terminated event
    {
        let mut procs = ACTIVE_PROCESSES.lock().unwrap_or_else(|e| e.into_inner());
        procs.remove(&job_id);
    }
    Err("FFmpeg process ended unexpectedly".to_string())
}

#[tauri::command]
pub async fn cancel_processing() -> Result<(), String> {
    let pids: Vec<u32> = {
        let mut procs = ACTIVE_PROCESSES.lock().unwrap_or_else(|e| e.into_inner());
        let pids: Vec<u32> = procs.values().copied().collect();
        procs.clear(); // Clear all so Terminated handler detects cancellation
        pids
    };

    if pids.is_empty() {
        return Err("No active processing to cancel".to_string());
    }

    for pid in pids {
        // Kill the FFmpeg process tree
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .output();
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = std::process::Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output();
        }
    }

    Ok(())
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
        .map_err(|e| format!("FFmpeg binary not found. Please reinstall the app: {}", e))?
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
