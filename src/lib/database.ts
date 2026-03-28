/**
 * Database operations via Tauri SQL plugin.
 * All queries go through the frontend SQL plugin connection.
 * API keys and secrets are stored in encrypted Stronghold vault (see secrets.ts).
 */

import { isSecretKey, setSecret, getSecret, getAllSecrets } from "./secrets";

let dbPromise: Promise<any> | null = null;
let initStarted = false;

async function getDb() {
  if (!dbPromise) {
    if (initStarted) {
      // Another call is already initializing — wait for it
      while (!dbPromise) {
        await new Promise((r) => setTimeout(r, 10));
      }
      return dbPromise;
    }
    initStarted = true;
    dbPromise = initDb().catch((err) => {
      dbPromise = null;
      initStarted = false;
      throw err;
    });
  }
  return dbPromise;
}

async function initDb() {
  const Database = await import("@tauri-apps/plugin-sql");
  const db = await Database.default.load("sqlite:mam_podcast_studio.db");

  // Run migrations
  await db.execute(`
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_number INTEGER,
      title TEXT NOT NULL,
      recording_date TEXT,
      guest_names TEXT,
      tags TEXT,
      original_video_path TEXT,
      enhanced_video_path TEXT,
      transcript TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
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
  `);

  await db.execute(`
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
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS show_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER,
      title TEXT,
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
  `);

  // Migration: make episode_id nullable and add title column for standalone show notes.
  // SQLite doesn't support ALTER COLUMN, so we recreate the table if needed.
  try {
    // Check if episode_id is NOT NULL in the existing table
    const tableInfo: { name: string; notnull: number }[] = await db.select(
      "PRAGMA table_info(show_notes)"
    );
    const episodeIdCol = tableInfo.find((c: { name: string }) => c.name === "episode_id");
    const hasTitleCol = tableInfo.some((c: { name: string }) => c.name === "title");

    if (episodeIdCol?.notnull === 1 || !hasTitleCol) {
      await db.execute(`ALTER TABLE show_notes RENAME TO show_notes_old`);
      await db.execute(`
        CREATE TABLE show_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          episode_id INTEGER,
          title TEXT,
          transcript_path TEXT,
          generated_content TEXT,
          edited_content TEXT,
          template_used TEXT,
          tokens_used INTEGER,
          version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
        )
      `);
      await db.execute(`
        INSERT INTO show_notes (id, episode_id, transcript_path, generated_content, edited_content, template_used, tokens_used, version, created_at, updated_at)
        SELECT id, episode_id, transcript_path, generated_content, edited_content, template_used, tokens_used, version, created_at, updated_at
        FROM show_notes_old
      `);
      await db.execute(`DROP TABLE show_notes_old`);
    }
  } catch {
    // Migration already applied or fresh DB — ignore
  }

  // Migration: add transcript column to episodes
  try {
    await db.execute(`ALTER TABLE episodes ADD COLUMN transcript TEXT`);
  } catch {
    // Column already exists — ignore
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS thumbnails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL,
      template_id TEXT NOT NULL,
      config_json TEXT NOT NULL,
      exported_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

// ─── Episodes ───────────────────────────────────────────────────

export interface EpisodeRow {
  id: number;
  episode_number: number | null;
  title: string;
  recording_date: string | null;
  guest_names: string | null;
  tags: string | null;
  original_video_path: string | null;
  enhanced_video_path: string | null;
  transcript: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function createEpisode(data: {
  episode_number?: number;
  title: string;
  recording_date?: string;
  guest_names?: string[];
  tags?: string[];
  original_video_path?: string;
}): Promise<number> {
  const conn = await getDb();
  const result = await conn.execute(
    `INSERT INTO episodes (episode_number, title, recording_date, guest_names, tags, original_video_path)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      data.episode_number || null,
      data.title,
      data.recording_date || null,
      data.guest_names ? JSON.stringify(data.guest_names) : null,
      data.tags ? JSON.stringify(data.tags) : null,
      data.original_video_path || null,
    ]
  );
  return result.lastInsertId;
}

export async function getEpisode(id: number): Promise<EpisodeRow | null> {
  const conn = await getDb();
  const rows: EpisodeRow[] = await conn.select(
    "SELECT * FROM episodes WHERE id = $1",
    [id]
  );
  return rows[0] || null;
}

export async function listEpisodes(): Promise<EpisodeRow[]> {
  const conn = await getDb();
  return conn.select("SELECT * FROM episodes ORDER BY created_at DESC");
}

export async function updateEpisode(
  id: number,
  data: Partial<{
    title: string;
    status: string;
    enhanced_video_path: string;
    transcript: string;
    episode_number: number;
    recording_date: string;
    guest_names: string[];
    tags: string[];
  }>
): Promise<void> {
  const conn = await getDb();
  const sets: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.title !== undefined) {
    sets.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.status !== undefined) {
    sets.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }
  if (data.enhanced_video_path !== undefined) {
    sets.push(`enhanced_video_path = $${paramIndex++}`);
    values.push(data.enhanced_video_path);
  }
  if (data.transcript !== undefined) {
    sets.push(`transcript = $${paramIndex++}`);
    values.push(data.transcript);
  }
  if (data.episode_number !== undefined) {
    sets.push(`episode_number = $${paramIndex++}`);
    values.push(data.episode_number);
  }
  if (data.recording_date !== undefined) {
    sets.push(`recording_date = $${paramIndex++}`);
    values.push(data.recording_date);
  }
  if (data.guest_names !== undefined) {
    sets.push(`guest_names = $${paramIndex++}`);
    values.push(data.guest_names ? JSON.stringify(data.guest_names) : null);
  }
  if (data.tags !== undefined) {
    sets.push(`tags = $${paramIndex++}`);
    values.push(data.tags ? JSON.stringify(data.tags) : null);
  }

  // Guard: if no fields to update (only updated_at), skip the query
  if (sets.length === 0) return;

  sets.push(`updated_at = datetime('now')`);
  values.push(id);

  await conn.execute(
    `UPDATE episodes SET ${sets.join(", ")} WHERE id = $${paramIndex}`,
    values
  );
}

export async function deleteEpisode(id: number): Promise<void> {
  const conn = await getDb();
  await conn.execute("DELETE FROM episodes WHERE id = $1", [id]);
}

export async function getNextEpisodeNumber(): Promise<number> {
  const conn = await getDb();
  const rows: { max_num: number | null }[] = await conn.select(
    "SELECT MAX(episode_number) as max_num FROM episodes"
  );
  return (rows[0]?.max_num || 0) + 1;
}

// ─── Enhancement Runs ───────────────────────────────────────────

export async function createEnhancementRun(data: {
  episode_id: number;
  method: string;
  preset_name: string;
  settings_json?: string;
}): Promise<number> {
  const conn = await getDb();
  const result = await conn.execute(
    `INSERT INTO enhancement_runs (episode_id, method, preset_name, settings_json)
     VALUES ($1, $2, $3, $4)`,
    [data.episode_id, data.method, data.preset_name, data.settings_json || null]
  );
  return result.lastInsertId;
}

export async function updateEnhancementRun(
  id: number,
  data: { status: string; duration_seconds?: number; error_message?: string }
): Promise<void> {
  const conn = await getDb();
  await conn.execute(
    `UPDATE enhancement_runs SET status = $1, duration_seconds = $2, error_message = $3 WHERE id = $4`,
    [data.status, data.duration_seconds || null, data.error_message || null, id]
  );
}

// ─── Audio Exports ──────────────────────────────────────────────

export async function createAudioExport(data: {
  episode_id: number;
  format: string;
  file_path: string;
  bitrate?: number;
  file_size_bytes?: number;
}): Promise<number> {
  const conn = await getDb();
  const result = await conn.execute(
    `INSERT INTO audio_exports (episode_id, format, file_path, bitrate, file_size_bytes)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      data.episode_id,
      data.format,
      data.file_path,
      data.bitrate || null,
      data.file_size_bytes || null,
    ]
  );
  return result.lastInsertId;
}

export async function getAudioExports(
  episodeId: number
): Promise<
  { id: number; format: string; file_path: string; file_size_bytes: number }[]
> {
  const conn = await getDb();
  return conn.select(
    "SELECT * FROM audio_exports WHERE episode_id = $1 ORDER BY created_at DESC",
    [episodeId]
  );
}

// ─── Show Notes ─────────────────────────────────────────────────

export interface ShowNoteRow {
  id: number;
  episode_id: number | null;
  title: string | null;
  transcript_path: string | null;
  generated_content: string;
  edited_content: string;
  template_used: string;
  tokens_used: number | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export async function saveShowNotes(data: {
  episode_id?: number;
  title?: string;
  transcript_path?: string;
  generated_content: string;
  edited_content?: string;
  template_used?: string;
  tokens_used?: number;
}): Promise<number> {
  const conn = await getDb();

  // Version by episode_id if present, otherwise by title
  let version = 1;
  if (data.episode_id) {
    const rows: { max_ver: number | null }[] = await conn.select(
      "SELECT MAX(version) as max_ver FROM show_notes WHERE episode_id = $1",
      [data.episode_id]
    );
    version = (rows[0]?.max_ver || 0) + 1;
  }

  const result = await conn.execute(
    `INSERT INTO show_notes (episode_id, title, transcript_path, generated_content, edited_content, template_used, tokens_used, version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      data.episode_id || null,
      data.title || null,
      data.transcript_path || null,
      data.generated_content,
      data.edited_content || data.generated_content,
      data.template_used || "default",
      data.tokens_used || null,
      version,
    ]
  );
  return result.lastInsertId;
}

export async function getShowNotes(
  episodeId: number
): Promise<ShowNoteRow[]> {
  const conn = await getDb();
  return conn.select(
    "SELECT * FROM show_notes WHERE episode_id = $1 ORDER BY version DESC",
    [episodeId]
  );
}

export async function listAllShowNotes(): Promise<ShowNoteRow[]> {
  const conn = await getDb();
  return conn.select(
    `SELECT sn.*, e.title as episode_title
     FROM show_notes sn
     LEFT JOIN episodes e ON sn.episode_id = e.id
     ORDER BY sn.updated_at DESC`
  );
}

export async function getShowNoteById(id: number): Promise<ShowNoteRow | null> {
  const conn = await getDb();
  const rows: ShowNoteRow[] = await conn.select(
    "SELECT * FROM show_notes WHERE id = $1",
    [id]
  );
  return rows[0] || null;
}

export async function updateShowNoteContent(
  id: number,
  editedContent: string
): Promise<void> {
  const conn = await getDb();
  await conn.execute(
    "UPDATE show_notes SET edited_content = $1, updated_at = datetime('now') WHERE id = $2",
    [editedContent, id]
  );
}

export async function deleteShowNote(id: number): Promise<void> {
  const conn = await getDb();
  await conn.execute("DELETE FROM show_notes WHERE id = $1", [id]);
}

// ─── Thumbnails ────────────────────────────────────────────────

export async function saveThumbnail(data: {
  episode_id: number;
  template_id: string;
  config_json: string;
  exported_path?: string;
}): Promise<number> {
  const conn = await getDb();
  // Upsert: replace existing thumbnail for this episode
  await conn.execute(
    "DELETE FROM thumbnails WHERE episode_id = $1",
    [data.episode_id]
  );
  const result = await conn.execute(
    `INSERT INTO thumbnails (episode_id, template_id, config_json, exported_path)
     VALUES ($1, $2, $3, $4)`,
    [data.episode_id, data.template_id, data.config_json, data.exported_path || null]
  );
  return result.lastInsertId;
}

export async function getThumbnail(
  episodeId: number
): Promise<{ id: number; template_id: string; config_json: string; exported_path: string | null } | null> {
  const conn = await getDb();
  const rows: any[] = await conn.select(
    "SELECT * FROM thumbnails WHERE episode_id = $1 ORDER BY updated_at DESC LIMIT 1",
    [episodeId]
  );
  return rows[0] || null;
}

export async function updateThumbnailExportPath(
  id: number,
  path: string
): Promise<void> {
  const conn = await getDb();
  await conn.execute(
    "UPDATE thumbnails SET exported_path = $1, updated_at = datetime('now') WHERE id = $2",
    [path, id]
  );
}

// ─── Settings ───────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  // Route secret keys through encrypted vault
  if (isSecretKey(key)) {
    const secret = await getSecret(key);
    if (secret) return secret;
    // Fall back to SQLite for migration (read old plaintext, then migrate)
    const conn = await getDb();
    const rows: { value: string }[] = await conn.select(
      "SELECT value FROM settings WHERE key = $1",
      [key]
    );
    const oldValue = rows[0]?.value || null;
    if (oldValue) {
      // Migrate: move from SQLite to vault, then remove from SQLite
      await setSecret(key, oldValue);
      await conn.execute("DELETE FROM settings WHERE key = $1", [key]);
    }
    return oldValue;
  }

  const conn = await getDb();
  const rows: { value: string }[] = await conn.select(
    "SELECT value FROM settings WHERE key = $1",
    [key]
  );
  return rows[0]?.value || null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  // Route secret keys through encrypted vault
  if (isSecretKey(key)) {
    const stored = await setSecret(key, value);
    if (stored) return;
    // If vault failed, fall through to SQLite as fallback
  }

  const conn = await getDb();
  await conn.execute(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = datetime('now')`,
    [key, value]
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const conn = await getDb();
  const rows: { key: string; value: string }[] = await conn.select(
    "SELECT key, value FROM settings"
  );
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  // Overlay secrets from encrypted vault (and auto-migrate any old plaintext keys)
  const secrets = await getAllSecrets();
  for (const [key, value] of Object.entries(secrets)) {
    settings[key] = value;
    // If this key still exists in SQLite, migrate it out
    if (rows.some((r) => r.key === key)) {
      await conn.execute("DELETE FROM settings WHERE key = $1", [key]);
    }
  }

  return settings;
}
