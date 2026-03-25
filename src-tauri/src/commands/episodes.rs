use crate::models::Episode;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateEpisodeRequest {
    pub episode_number: Option<i64>,
    pub title: String,
    pub recording_date: Option<String>,
    pub guest_names: Option<String>,
    pub tags: Option<String>,
    pub original_video_path: Option<String>,
}

#[tauri::command]
pub async fn create_episode(
    _app: tauri::AppHandle,
    request: CreateEpisodeRequest,
) -> Result<Episode, String> {
    // The actual DB operations go through the frontend SQL plugin.
    // This command is a convenience wrapper for validation/transformation.
    Ok(Episode {
        id: None,
        episode_number: request.episode_number,
        title: request.title,
        recording_date: request.recording_date,
        guest_names: request.guest_names,
        tags: request.tags,
        original_video_path: request.original_video_path,
        enhanced_video_path: None,
        status: "draft".to_string(),
        created_at: None,
        updated_at: None,
    })
}

#[tauri::command]
pub async fn get_episode(_app: tauri::AppHandle, _id: i64) -> Result<Episode, String> {
    Err("Use SQL plugin for direct queries".to_string())
}

#[tauri::command]
pub async fn list_episodes(_app: tauri::AppHandle) -> Result<Vec<Episode>, String> {
    Ok(vec![])
}

#[tauri::command]
pub async fn update_episode(
    _app: tauri::AppHandle,
    _id: i64,
    _title: Option<String>,
    _status: Option<String>,
    _enhanced_video_path: Option<String>,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn delete_episode(_app: tauri::AppHandle, _id: i64) -> Result<(), String> {
    Ok(())
}
