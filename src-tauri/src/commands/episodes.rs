use crate::models::Episode;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

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
    app: AppHandle,
    request: CreateEpisodeRequest,
) -> Result<Episode, String> {
    // For now, return a constructed episode.
    // The actual DB operations will go through the frontend SQL plugin.
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
pub async fn get_episode(app: AppHandle, id: i64) -> Result<Episode, String> {
    // Placeholder - frontend uses SQL plugin directly
    Err("Use SQL plugin for direct queries".to_string())
}

#[tauri::command]
pub async fn list_episodes(app: AppHandle) -> Result<Vec<Episode>, String> {
    // Placeholder - frontend uses SQL plugin directly
    Ok(vec![])
}

#[tauri::command]
pub async fn update_episode(
    app: AppHandle,
    id: i64,
    title: Option<String>,
    status: Option<String>,
    enhanced_video_path: Option<String>,
) -> Result<(), String> {
    // Placeholder - frontend uses SQL plugin directly
    Ok(())
}

#[tauri::command]
pub async fn delete_episode(app: AppHandle, id: i64) -> Result<(), String> {
    // Placeholder - frontend uses SQL plugin directly
    Ok(())
}
