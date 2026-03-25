use anyhow::Result;
use tauri::AppHandle;

const MIGRATION_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_number INTEGER,
    title TEXT NOT NULL,
    recording_date TEXT,
    guest_names TEXT,
    tags TEXT,
    original_video_path TEXT,
    enhanced_video_path TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audio_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    format TEXT NOT NULL,
    file_path TEXT NOT NULL,
    bitrate INTEGER,
    file_size_bytes INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS enhancement_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    method TEXT NOT NULL,
    preset_name TEXT,
    settings_json TEXT,
    duration_seconds REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS show_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    transcript_path TEXT,
    generated_content TEXT,
    edited_content TEXT,
    template_used TEXT,
    tokens_used INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"#;

pub async fn initialize(_app_handle: &AppHandle) -> Result<()> {
    // The SQL plugin handles database creation via the preload config.
    // Migrations are run when the frontend connects to the database.
    // We log that initialization is ready.
    println!("Database initialization ready - migrations will run on first connection");
    Ok(())
}

/// Returns the migration SQL for use by the frontend SQL plugin
pub fn get_migration_sql() -> &'static str {
    MIGRATION_SQL
}
