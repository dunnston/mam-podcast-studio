use crate::cleanvoice::{CleanvoiceClient, CleanvoiceProgress, EditConfig};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

// Track active Cleanvoice job for cancellation
static ACTIVE_JOB: std::sync::LazyLock<Arc<Mutex<Option<String>>>> =
    std::sync::LazyLock::new(|| Arc::new(Mutex::new(None)));

// Track cancellation flag
static CANCELLED: std::sync::LazyLock<Arc<Mutex<bool>>> =
    std::sync::LazyLock::new(|| Arc::new(Mutex::new(false)));

#[derive(serde::Deserialize)]
pub struct CleanvoiceEnhanceRequest {
    pub api_key: String,
    pub input_path: String,
    pub output_path: String,
    /// Enhancement options
    pub studio_sound: Option<bool>,
    pub remove_noise: Option<bool>,
    pub normalize: Option<bool>,
    pub fillers: Option<bool>,
    pub mouth_sounds: Option<bool>,
    pub long_silences: Option<bool>,
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

    let client = CleanvoiceClient::new(&request.api_key);
    let input_path = PathBuf::from(&request.input_path);
    let output_path = PathBuf::from(&request.output_path);

    let config = EditConfig {
        studio_sound: if request.studio_sound.unwrap_or(true) {
            Some(serde_json::Value::String("nightly".to_string()))
        } else {
            None
        },
        remove_noise: request.remove_noise.or(Some(true)),
        normalize: request.normalize,
        target_lufs: None,
        fillers: request.fillers,
        mouth_sounds: request.mouth_sounds,
        breath: None,
        long_silences: request.long_silences,
        export_format: Some("wav".to_string()),
    };

    let app_clone = app.clone();
    let result = client
        .enhance_audio(&input_path, &output_path, config, move |progress: CleanvoiceProgress| {
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
            // Check if it was a cancellation
            let cancelled = CANCELLED.lock().unwrap();
            if *cancelled {
                return "Processing cancelled".to_string();
            }
            e.to_string()
        })?;

    // Clear active job
    {
        let mut job = ACTIVE_JOB.lock().unwrap();
        *job = None;
    }

    // Return stats if available
    if let Some(ref edit_result) = result.result {
        if let Some(ref stats) = edit_result.statistics {
            let _ = app.emit("cleanvoice-stats", stats);
        }
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
pub async fn test_cleanvoice_api(api_key: String) -> Result<bool, String> {
    let client = CleanvoiceClient::new(&api_key);
    client
        .test_connection()
        .await
        .map_err(|e| e.to_string())
}
