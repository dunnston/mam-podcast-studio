use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use std::path::Path;

/// Extract a single frame from a video at a given timestamp using FFmpeg sidecar.
/// Returns the output file path.
#[tauri::command]
pub async fn extract_frame(
    app: AppHandle,
    video_path: String,
    timestamp_secs: f64,
    output_path: String,
) -> Result<String, String> {
    // Format timestamp as HH:MM:SS.mmm for FFmpeg
    let hours = (timestamp_secs / 3600.0).floor() as u64;
    let minutes = ((timestamp_secs % 3600.0) / 60.0).floor() as u64;
    let seconds = timestamp_secs % 60.0;
    let timestamp = format!("{:02}:{:02}:{:06.3}", hours, minutes, seconds);

    let output = app
        .shell()
        .sidecar("ffmpeg")
        .expect("failed to create ffmpeg sidecar")
        .args([
            "-y",
            "-ss", &timestamp,
            "-i", &video_path,
            "-vframes", "1",
            "-q:v", "2",
            &output_path,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg frame extraction failed: {}", stderr));
    }

    // Verify the output file exists
    if !Path::new(&output_path).exists() {
        return Err("Frame extraction produced no output file".to_string());
    }

    Ok(output_path)
}

/// Remove the background from an image using the remove.bg API.
/// Returns the result as a base64-encoded PNG data URL.
#[tauri::command]
pub async fn remove_background(
    image_path: String,
    api_key: String,
) -> Result<String, String> {
    let image_bytes = tokio::fs::read(&image_path)
        .await
        .map_err(|e| format!("Failed to read image file: {}", e))?;

    let file_name = Path::new(&image_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let file_part = reqwest::multipart::Part::bytes(image_bytes)
        .file_name(file_name)
        .mime_str("image/png")
        .map_err(|e| format!("Failed to create multipart: {}", e))?;

    let form = reqwest::multipart::Form::new()
        .part("image_file", file_part)
        .text("size", "auto")
        .text("format", "png");

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.remove.bg/v1.0/removebg")
        .header("X-Api-Key", &api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("remove.bg API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("remove.bg API error ({}): {}", status, body));
    }

    let result_bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read remove.bg response: {}", e))?;

    // Convert to base64 data URL
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&result_bytes);
    Ok(format!("data:image/png;base64,{}", b64))
}
