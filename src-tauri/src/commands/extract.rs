use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;

#[derive(serde::Deserialize)]
pub struct ExtractionRequest {
    pub input_path: String,
    pub output_dir: String,
    pub episode_name: String,
    pub formats: Vec<String>, // ["mp3", "m4a", "wav"]
    #[allow(dead_code)]
    pub total_duration: f64,
    // Metadata
    pub title: Option<String>,
    pub episode_number: Option<i64>,
    pub show_name: Option<String>,
}

#[derive(serde::Serialize, Clone)]
pub struct ExtractionResult {
    pub format: String,
    pub file_path: String,
    pub file_size_bytes: u64,
}

#[tauri::command]
pub async fn extract_audio(
    app: AppHandle,
    request: ExtractionRequest,
) -> Result<Vec<ExtractionResult>, String> {
    let mut results = Vec::new();

    for format in &request.formats {
        let (output_path, args) = match format.as_str() {
            "mp3" => {
                let output_path = format!(
                    "{}/{}.mp3",
                    &request.output_dir, &request.episode_name
                );
                let mut args = vec![
                    "-y".to_string(),
                    "-i".to_string(),
                    request.input_path.clone(),
                    "-vn".to_string(),
                    "-acodec".to_string(),
                    "libmp3lame".to_string(),
                    "-b:a".to_string(),
                    "320k".to_string(),
                ];
                // Add ID3 metadata
                if let Some(ref title) = request.title {
                    args.extend(["-metadata".to_string(), format!("title={}", title)]);
                }
                if let Some(num) = request.episode_number {
                    args.extend(["-metadata".to_string(), format!("track={}", num)]);
                }
                if let Some(ref show) = request.show_name {
                    args.extend(["-metadata".to_string(), format!("album={}", show)]);
                    args.extend(["-metadata".to_string(), format!("artist={}", show)]);
                }
                args.push(output_path.clone());
                (output_path, args)
            }
            "m4a" => {
                let output_path = format!(
                    "{}/{}.m4a",
                    &request.output_dir, &request.episode_name
                );
                let mut args = vec![
                    "-y".to_string(),
                    "-i".to_string(),
                    request.input_path.clone(),
                    "-vn".to_string(),
                    "-acodec".to_string(),
                    "aac".to_string(),
                    "-b:a".to_string(),
                    "192k".to_string(),
                ];
                if let Some(ref title) = request.title {
                    args.extend(["-metadata".to_string(), format!("title={}", title)]);
                }
                if let Some(num) = request.episode_number {
                    args.extend(["-metadata".to_string(), format!("track={}", num)]);
                }
                if let Some(ref show) = request.show_name {
                    args.extend(["-metadata".to_string(), format!("album={}", show)]);
                    args.extend(["-metadata".to_string(), format!("artist={}", show)]);
                }
                args.push(output_path.clone());
                (output_path, args)
            }
            "wav" => {
                let output_path = format!(
                    "{}/{}.wav",
                    &request.output_dir, &request.episode_name
                );
                let args = vec![
                    "-y".to_string(),
                    "-i".to_string(),
                    request.input_path.clone(),
                    "-vn".to_string(),
                    "-acodec".to_string(),
                    "pcm_s16le".to_string(),
                    output_path.clone(),
                ];
                (output_path, args)
            }
            _ => continue,
        };

        let _ = app.emit("extraction-progress", serde_json::json!({
            "format": format,
            "status": "processing"
        }));

        let output = app
            .shell()
            .sidecar("ffmpeg")
            .expect("failed to create ffmpeg sidecar")
            .args(&args)
            .output()
            .await
            .map_err(|e| format!("Failed to extract {}: {}", format, e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("FFmpeg extraction failed for {}: {}", format, stderr));
        }

        // Get file size
        let file_size = std::fs::metadata(&output_path)
            .map(|m| m.len())
            .unwrap_or(0);

        results.push(ExtractionResult {
            format: format.clone(),
            file_path: output_path,
            file_size_bytes: file_size,
        });

        let _ = app.emit("extraction-progress", serde_json::json!({
            "format": format,
            "status": "done"
        }));
    }

    Ok(results)
}
