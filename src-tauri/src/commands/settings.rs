use crate::claude;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_setting(app: AppHandle, key: String) -> Result<Option<String>, String> {
    // Settings are managed via the frontend SQL plugin directly
    // This command is a convenience wrapper
    Ok(None)
}

#[tauri::command]
pub async fn set_setting(
    app: AppHandle,
    key: String,
    value: String,
) -> Result<(), String> {
    // Settings are managed via the frontend SQL plugin directly
    Ok(())
}

#[tauri::command]
pub async fn get_all_settings(app: AppHandle) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({}))
}

#[tauri::command]
pub async fn test_claude_api(api_key: String) -> Result<bool, String> {
    claude::test_connection(&api_key)
        .await
        .map_err(|e| e.to_string())
}
