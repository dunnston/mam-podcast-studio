use crate::claude;

#[tauri::command]
pub async fn get_setting(_app: tauri::AppHandle, _key: String) -> Result<Option<String>, String> {
    // Settings are managed via the frontend SQL plugin directly
    Ok(None)
}

#[tauri::command]
pub async fn set_setting(
    _app: tauri::AppHandle,
    _key: String,
    _value: String,
) -> Result<(), String> {
    // Settings are managed via the frontend SQL plugin directly
    Ok(())
}

#[tauri::command]
pub async fn get_all_settings(_app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({}))
}

#[tauri::command]
pub async fn test_claude_api(api_key: String) -> Result<bool, String> {
    claude::test_connection(&api_key)
        .await
        .map_err(|e| e.to_string())
}
