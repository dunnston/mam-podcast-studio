use crate::podbean::{PodbeanClient, PodbeanProgress};
use tauri::{AppHandle, Emitter};

#[derive(serde::Deserialize, Debug)]
pub struct PodbeanPublishRequest {
    pub client_id: String,
    pub client_secret: String,
    pub audio_path: String,
    pub title: String,
    pub content: String,
    /// "publish", "draft", or "future"
    pub status: Option<String>,
}

#[derive(serde::Serialize, Debug)]
pub struct PodbeanPublishResult {
    pub episode_id: Option<String>,
    pub permalink_url: Option<String>,
    pub media_url: Option<String>,
}

#[tauri::command]
pub async fn podbean_publish(
    app: AppHandle,
    request: PodbeanPublishRequest,
) -> Result<PodbeanPublishResult, String> {
    eprintln!("[Podbean] Starting publish for: {}", request.title);

    let client = PodbeanClient::new(&request.client_id, &request.client_secret);
    let audio_path = std::path::PathBuf::from(&request.audio_path);
    let status = request.status.as_deref().unwrap_or("draft");

    let app_clone = app.clone();
    let result = client
        .publish(&audio_path, &request.title, &request.content, status, move |progress: PodbeanProgress| {
            let _ = app_clone.emit("podbean-progress", &progress);
        })
        .await
        .map_err(|e| e.to_string())?;

    let publish_result = if let Some(ep) = result.episode {
        PodbeanPublishResult {
            episode_id: ep.id,
            permalink_url: ep.permalink_url,
            media_url: ep.media_url,
        }
    } else {
        PodbeanPublishResult {
            episode_id: None,
            permalink_url: None,
            media_url: None,
        }
    };

    Ok(publish_result)
}

#[tauri::command]
pub async fn test_podbean_api(
    client_id: String,
    client_secret: String,
) -> Result<serde_json::Value, String> {
    let client = PodbeanClient::new(&client_id, &client_secret);
    let token = client
        .test_connection()
        .await
        .map_err(|e| e.to_string())?;

    serde_json::to_value(&token).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn podbean_list_podcasts(
    client_id: String,
    client_secret: String,
) -> Result<serde_json::Value, String> {
    let client = PodbeanClient::new(&client_id, &client_secret);
    let token = client
        .test_connection()
        .await
        .map_err(|e| e.to_string())?;

    let podcasts = client
        .list_podcasts(&token.access_token)
        .await
        .map_err(|e| e.to_string())?;

    serde_json::to_value(&podcasts).map_err(|e| e.to_string())
}
