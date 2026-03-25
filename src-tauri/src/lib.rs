mod commands;
mod cleanvoice;
mod db;
mod ffmpeg;
mod claude;
mod models;
mod podbean;
mod youtube;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .build(),
        )
        .setup(|app| {
            // Initialize the database on first launch
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = db::initialize(&app_handle).await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Episode commands
            commands::episodes::create_episode,
            commands::episodes::get_episode,
            commands::episodes::list_episodes,
            commands::episodes::update_episode,
            commands::episodes::delete_episode,
            // FFmpeg commands
            commands::enhance::probe_video,
            commands::enhance::enhance_audio,
            commands::enhance::cancel_processing,
            commands::enhance::preview_enhancement,
            // Extraction commands
            commands::extract::extract_audio,
            // Show notes commands
            commands::show_notes::generate_show_notes,
            commands::show_notes::read_transcript,
            // Cleanvoice commands
            commands::cleanvoice::cleanvoice_enhance,
            commands::cleanvoice::cleanvoice_cancel,
            commands::cleanvoice::test_cleanvoice_api,
            // Podbean commands
            commands::podbean::podbean_publish,
            commands::podbean::test_podbean_api,
            commands::podbean::podbean_list_podcasts,
            // YouTube commands
            commands::youtube::youtube_oauth_start,
            commands::youtube::youtube_refresh_token,
            commands::youtube::youtube_upload,
            // Settings commands
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
            commands::settings::test_claude_api,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MAM Podcast Studio");
}
