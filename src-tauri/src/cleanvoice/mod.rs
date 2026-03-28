use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

const BASE_URL: &str = "https://api.cleanvoice.ai/v2";

/// Cleanvoice API client — matches v2 REST API docs exactly
pub struct CleanvoiceClient {
    api_key: String,
    http: reqwest::Client,
}

// ─── Request / Response types ────────────────────────────────────

/// Edit request body: POST /v2/edits
#[derive(Serialize, Debug)]
pub struct EditRequest {
    pub input: EditInput,
}

#[derive(Serialize, Debug)]
pub struct EditInput {
    pub files: Vec<String>,
    pub config: EditConfig,
}

/// Configuration for a Cleanvoice edit job.
/// All values are FLAT (not nested with `{ "enabled": true }`).
/// See: Configuration Reference docs.
#[derive(Serialize, Debug, Default, Clone)]
pub struct EditConfig {
    // ── Audio cleaning ──────────────────────────────────────────
    /// Remove "um", "uh", "like" filler words
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fillers: Option<bool>,
    /// Trim long pauses and gaps
    #[serde(skip_serializing_if = "Option::is_none")]
    pub long_silences: Option<bool>,
    /// Remove clicks, lip smacks, tongue sounds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mouth_sounds: Option<bool>,
    /// Remove audible breathing. true | "legacy" | "natural" | false
    #[serde(skip_serializing_if = "Option::is_none")]
    pub breath: Option<serde_json::Value>,
    /// Remove repeated word fragments ("I— I— I think")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stutters: Option<bool>,
    /// Remove short hesitation sounds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hesitations: Option<bool>,
    /// Silence edits instead of cutting — preserves original timing
    #[serde(skip_serializing_if = "Option::is_none")]
    pub muted: Option<bool>,

    // ── Audio enhancement ───────────────────────────────────────
    /// Reduce hiss, hum, fan noise, background sounds (default: true in API)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remove_noise: Option<bool>,
    /// Aggressive studio-quality enhancement. true | "nightly" | false
    #[serde(skip_serializing_if = "Option::is_none")]
    pub studio_sound: Option<serde_json::Value>,
    /// Balance volume levels throughout the file
    #[serde(skip_serializing_if = "Option::is_none")]
    pub normalize: Option<bool>,
    /// Preserve music sections during noise reduction
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keep_music: Option<bool>,

    // ── Output ──────────────────────────────────────────────────
    /// Output format: "auto", "mp3", "wav", "flac", "m4a"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub export_format: Option<String>,
    /// Target LUFS loudness (-16 is podcast standard)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_lufs: Option<f64>,

    // ── Content generation ──────────────────────────────────────
    /// Full word-by-word transcript
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transcription: Option<bool>,
    /// Chapter markers, key learnings, episode summary
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summarize: Option<bool>,

    // ── Advanced ────────────────────────────────────────────────
    /// Must be true for video editing (cuts applied to video timeline)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video: Option<bool>,
}

impl EditConfig {
    /// Returns true if any editing features are enabled (features that CUT content)
    /// These require sending the actual video file when working with video.
    pub fn has_editing_features(&self) -> bool {
        self.fillers.unwrap_or(false)
            || self.long_silences.unwrap_or(false)
            || self.mouth_sounds.unwrap_or(false)
            || self.stutters.unwrap_or(false)
            || self.hesitations.unwrap_or(false)
            || matches!(&self.breath, Some(v) if v.as_bool().unwrap_or(false) || v.is_string())
    }

    /// Returns true if only enhancement features are enabled (no cuts)
    /// Enhancement-only jobs should extract audio first for faster upload.
    pub fn is_enhancement_only(&self) -> bool {
        !self.has_editing_features()
    }
}

/// Response from POST /v2/edits
#[derive(Deserialize, Debug)]
pub struct EditResponse {
    pub id: String,
    pub status: String,
}

/// Response from GET /v2/edits/{id}
/// Handles both documented format and actual API format
#[derive(Deserialize, Debug, Clone, Serialize)]
pub struct EditStatus {
    #[serde(alias = "task_id", default)]
    pub id: Option<String>,
    pub status: String,
    pub result: Option<EditResult>,
    pub error: Option<String>,
}

#[derive(Deserialize, Debug, Clone, Serialize)]
pub struct EditResult {
    /// Download URL for the processed file
    #[serde(alias = "download_url")]
    pub url: Option<String>,
    /// Output filename
    pub filename: Option<String>,
    /// Whether result is video
    pub video: Option<bool>,
    /// Edit statistics (e.g., {"MOUTH_SOUND": 7, "FILLER_SOUND": 1})
    pub statistics: Option<serde_json::Value>,
    /// Transcript (if transcription was enabled)
    #[serde(alias = "transcription")]
    pub transcript: Option<serde_json::Value>,
    /// Summary (if summarize was enabled)
    #[serde(alias = "summarization")]
    pub summary: Option<serde_json::Value>,
    /// Social content (if enabled)
    pub social_content: Option<serde_json::Value>,
    /// Progress: amount done (minutes processed)
    pub done: Option<f64>,
    /// Progress: total amount (minutes total)
    pub total: Option<f64>,
    /// Current processing state (e.g., "PREPROCESSING", "EDITING")
    pub state: Option<String>,
    /// Current processing phase
    pub phase: Option<u32>,
    /// Current step within phase
    pub step: Option<u32>,
    /// Job name
    pub job_name: Option<String>,
}

/// Response from POST /v2/upload(s)
/// Handles both old format (signedUrl) and new format (upload_url/file_url)
#[derive(Deserialize, Debug)]
pub struct UploadResponse {
    /// Signed URL for PUT upload
    #[serde(alias = "upload_url", alias = "signedUrl")]
    pub upload_url: String,
    /// URL to use in the edit request files array
    /// Falls back to upload_url if not present
    #[serde(alias = "file_url", default)]
    pub file_url: Option<String>,
}

/// Response from GET /v2/auth
#[derive(Deserialize, Debug, Serialize)]
pub struct AuthResponse {
    pub email: Option<String>,
    pub credits: Option<f64>,
}

// ─── Progress callback type ─────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct CleanvoiceProgress {
    pub stage: String,   // "extract", "upload", "processing", "download", "mux", "done"
    pub message: String,
    pub percent: f64,    // 0-100
}

// ─── Client implementation ───────────────────────────────────────

impl CleanvoiceClient {
    pub fn new(api_key: &str) -> Self {
        Self {
            api_key: api_key.to_string(),
            http: reqwest::Client::new(),
        }
    }

    /// Verify API key and check remaining credits
    pub async fn test_connection(&self) -> Result<AuthResponse> {
        let resp = self
            .http
            .get(format!("{}/auth", BASE_URL))
            .header("X-API-Key", &self.api_key)
            .send()
            .await
            .context("Failed to connect to Cleanvoice API")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Auth check failed ({}): {}", status, body);
        }

        resp.json().await.context("Failed to parse auth response")
    }

    /// Step 1: Request a signed upload URL from Cleanvoice
    /// Try multiple endpoint variants since docs are inconsistent
    pub async fn request_upload(&self, filename: &str, content_type: &str) -> Result<UploadResponse> {
        // Try both JSON body and query param variants
        let endpoints = [
            // Variant 1: /v2/upload (singular) with query params (original working endpoint)
            ("query", format!("{}/upload", BASE_URL)),
            // Variant 2: /v2/uploads (plural) with JSON body (per docs)
            ("json", format!("{}/uploads", BASE_URL)),
        ];

        for (variant, url) in &endpoints {
            log::info!("[Cleanvoice] Trying upload URL: {} ({})", url, variant);

            let resp = if *variant == "query" {
                self.http
                    .post(url)
                    .header("X-API-Key", &self.api_key)
                    .query(&[("filename", filename), ("content_type", content_type)])
                    .send()
                    .await
            } else {
                let body = serde_json::json!({
                    "filename": filename,
                    "content_type": content_type,
                });
                self.http
                    .post(url)
                    .header("X-API-Key", &self.api_key)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
                    .await
            };

            let resp = match resp {
                Ok(r) => r,
                Err(e) => {
                    log::info!("[Cleanvoice] {} variant failed to connect: {}", variant, e);
                    continue;
                }
            };

            let status = resp.status();
            let resp_text = resp.text().await.unwrap_or_default();
            log::info!("[Cleanvoice] {} response ({}): {}", variant, status, resp_text);

            if status.is_success() {
                let parsed: UploadResponse = serde_json::from_str(&resp_text)
                    .context("Failed to parse upload response")?;
                return Ok(parsed);
            }

            // If 404, try next variant
            if status.as_u16() == 404 {
                continue;
            }

            // Any other error, bail
            anyhow::bail!("Upload URL request failed ({}): {}", status, resp_text);
        }

        anyhow::bail!("All upload endpoint variants returned 404. The Cleanvoice upload API may have changed.")
    }

    /// Step 2: PUT file bytes to the signed upload URL
    pub async fn upload_file(&self, upload_url: &str, file_path: &Path, content_type: &str) -> Result<()> {
        let file_bytes = tokio::fs::read(file_path)
            .await
            .context("Failed to read file for upload")?;

        let resp = self
            .http
            .put(upload_url)
            .header("Content-Type", content_type)
            .body(file_bytes)
            .send()
            .await
            .context("Failed to upload file to Cleanvoice storage")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("File upload failed ({}): {}", status, body);
        }

        Ok(())
    }

    /// Step 3: Submit an edit job
    /// POST /v2/edits
    pub async fn submit_edit(&self, request: &EditRequest) -> Result<String> {
        let resp = self
            .http
            .post(format!("{}/edits", BASE_URL))
            .header("X-API-Key", &self.api_key)
            .header("Content-Type", "application/json")
            .json(request)
            .send()
            .await
            .context("Failed to submit edit to Cleanvoice")?;

        let status = resp.status();
        let resp_text = resp.text().await.unwrap_or_default();
        log::info!("[Cleanvoice] Edit response ({}): {}", status, resp_text);

        if !status.is_success() {
            // Try to extract a human-readable error message
            if let Ok(err_json) = serde_json::from_str::<serde_json::Value>(&resp_text) {
                if let Some(msg) = err_json.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()) {
                    anyhow::bail!("{}", msg);
                }
            }
            anyhow::bail!("Edit submission failed ({}): {}", status, resp_text);
        }

        // Try parsing as EditResponse, with fallback for unexpected formats
        if let Ok(edit_resp) = serde_json::from_str::<EditResponse>(&resp_text) {
            return Ok(edit_resp.id);
        }

        // Fallback: try extracting "id" from raw JSON
        if let Ok(raw) = serde_json::from_str::<serde_json::Value>(&resp_text) {
            if let Some(id) = raw.get("id").and_then(|v| v.as_str()) {
                return Ok(id.to_string());
            }
        }

        anyhow::bail!("Unexpected edit response format: {}", resp_text)
    }

    /// Step 4: Check the status of an edit job
    /// GET /v2/edits/{edit_id}
    pub async fn get_edit_status(&self, edit_id: &str) -> Result<EditStatus> {
        let resp = self
            .http
            .get(format!("{}/edits/{}", BASE_URL, edit_id))
            .header("X-API-Key", &self.api_key)
            .send()
            .await
            .context("Failed to check edit status")?;

        let status_code = resp.status();
        let resp_text = resp.text().await.unwrap_or_default();

        if !status_code.is_success() {
            anyhow::bail!("Status check failed ({}): {}", status_code, resp_text);
        }

        // Log raw response when status is SUCCESS (to debug download URL)
        if resp_text.contains("SUCCESS") {
            log::info!("[Cleanvoice] Raw SUCCESS response: {}", resp_text);
        }

        serde_json::from_str(&resp_text)
            .with_context(|| format!("Failed to parse edit status: {}", resp_text))
    }

    /// Step 5: Download the processed file to a local path
    pub async fn download_result(&self, download_url: &str, output_path: &Path) -> Result<()> {
        let resp = self
            .http
            .get(download_url)
            .send()
            .await
            .context("Failed to download processed file")?;

        if !resp.status().is_success() {
            anyhow::bail!("Download failed with status: {}", resp.status());
        }

        let bytes = resp.bytes().await.context("Failed to read download bytes")?;
        tokio::fs::write(output_path, &bytes)
            .await
            .context("Failed to write downloaded file")?;

        Ok(())
    }

    /// Cleanup: Delete an edit job and its files
    /// DELETE /v2/edits/{edit_id}
    pub async fn delete_edit(&self, edit_id: &str) -> Result<()> {
        let resp = self
            .http
            .delete(format!("{}/edits/{}", BASE_URL, edit_id))
            .header("X-API-Key", &self.api_key)
            .send()
            .await
            .context("Failed to delete edit")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Delete failed ({}): {}", status, body);
        }

        Ok(())
    }

    /// Convenience: Run the full enhancement pipeline
    /// Upload → Submit → Poll (30s initial, 10s intervals) → Download → Cleanup
    pub async fn enhance<F>(
        &self,
        input_path: &Path,
        output_path: &Path,
        config: EditConfig,
        on_progress: F,
    ) -> Result<EditStatus>
    where
        F: Fn(CleanvoiceProgress) + Send,
    {
        // ── Step 1: Upload file to Cleanvoice ──────────────────
        on_progress(CleanvoiceProgress {
            stage: "upload".to_string(),
            message: "Requesting upload URL...".to_string(),
            percent: 2.0,
        });

        let filename = input_path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "episode.mp4".to_string());

        let content_type = match input_path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .as_deref()
        {
            Some("mp4") => "video/mp4",
            Some("mov") => "video/quicktime",
            Some("mkv") => "video/x-matroska",
            Some("avi") => "video/x-msvideo",
            Some("webm") => "video/webm",
            Some("wav") => "audio/wav",
            Some("mp3") => "audio/mpeg",
            Some("m4a") => "audio/mp4",
            Some("aac") => "audio/aac",
            Some("flac") => "audio/flac",
            Some("ogg") => "audio/ogg",
            _ => "application/octet-stream",
        };

        let upload_resp = self.request_upload(&filename, content_type).await?;

        on_progress(CleanvoiceProgress {
            stage: "upload".to_string(),
            message: "Uploading file to Cleanvoice...".to_string(),
            percent: 5.0,
        });

        self.upload_file(&upload_resp.upload_url, input_path, content_type).await?;

        on_progress(CleanvoiceProgress {
            stage: "upload".to_string(),
            message: "Upload complete".to_string(),
            percent: 15.0,
        });

        // ── Step 2: Submit edit job ────────────────────────────
        on_progress(CleanvoiceProgress {
            stage: "processing".to_string(),
            message: "Submitting to Cleanvoice AI...".to_string(),
            percent: 18.0,
        });

        let request = EditRequest {
            input: EditInput {
                files: vec![upload_resp.file_url.unwrap_or_else(|| upload_resp.upload_url.clone())],
                config,
            },
        };

        // Log the request for debugging
        log::info!("[Cleanvoice] Submitting edit: {}", serde_json::to_string_pretty(&request).unwrap_or_default());

        let edit_id = self.submit_edit(&request).await?;
        log::info!("[Cleanvoice] Edit ID: {}", edit_id);

        // ── Step 3: Poll for completion ────────────────────────
        // Wait 30s before first poll (per docs)
        on_progress(CleanvoiceProgress {
            stage: "processing".to_string(),
            message: "Processing started, waiting for Cleanvoice AI...".to_string(),
            percent: 20.0,
        });

        tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;

        let mut poll_count = 0u32;
        let final_status = loop {
            let status = self.get_edit_status(&edit_id).await?;
            log::info!("[Cleanvoice] Poll #{}: status={}", poll_count + 1, status.status);

            match status.status.as_str() {
                "SUCCESS" => {
                    log::info!("[Cleanvoice] SUCCESS result: {:?}", status.result);
                    on_progress(CleanvoiceProgress {
                        stage: "processing".to_string(),
                        message: "Processing complete!".to_string(),
                        percent: 85.0,
                    });
                    break status;
                }
                "FAILURE" => {
                    let err_msg = status.error.clone().unwrap_or_else(|| "Unknown error".to_string());
                    anyhow::bail!("Cleanvoice processing failed: {}", err_msg);
                }
                _ => {
                    // PENDING, STARTED, PREPROCESSING, RETRY, etc.
                    // Use real progress from done/total if available
                    let (progress, detail) = if let Some(ref result) = status.result {
                        let done = result.done.unwrap_or(0.0);
                        let total = result.total.unwrap_or(1.0).max(0.01);
                        let pct = (done / total * 65.0) + 20.0; // Map to 20-85% range
                        let state = result.state.as_deref().unwrap_or(&status.status);
                        (pct.min(84.0), format!("{} ({:.0}/{:.0} min)", state, done, total))
                    } else {
                        let pct = (20.0 + (poll_count as f64 * 0.5)).min(84.0);
                        (pct, status.status.clone())
                    };

                    on_progress(CleanvoiceProgress {
                        stage: "processing".to_string(),
                        message: format!("Cleanvoice AI: {}", detail),
                        percent: progress,
                    });

                    poll_count += 1;

                    // Timeout after ~30 minutes (180 polls × 10 seconds)
                    if poll_count > 180 {
                        anyhow::bail!("Cleanvoice processing timed out after 30 minutes");
                    }

                    // Poll every 10 seconds (per docs)
                    tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                }
            }
        };

        // ── Step 4: Download result ────────────────────────────
        if let Some(ref result) = final_status.result {
            if let Some(ref url) = result.url {
                log::info!("[Cleanvoice] Downloading from: {}", url);
                on_progress(CleanvoiceProgress {
                    stage: "download".to_string(),
                    message: "Downloading processed file...".to_string(),
                    percent: 88.0,
                });

                self.download_result(url, output_path).await?;

                log::info!("[Cleanvoice] Downloaded to: {}", output_path.display());
                on_progress(CleanvoiceProgress {
                    stage: "download".to_string(),
                    message: "Download complete".to_string(),
                    percent: 95.0,
                });
            } else {
                log::info!("[Cleanvoice] WARNING: No download URL in result: {:?}", result);
                anyhow::bail!("Cleanvoice completed but no download URL was provided");
            }
        } else {
            log::info!("[Cleanvoice] WARNING: No result object in SUCCESS response");
            anyhow::bail!("Cleanvoice completed but no result was provided");
        }

        // ── Step 5: Cleanup edit from Cleanvoice ───────────────
        on_progress(CleanvoiceProgress {
            stage: "done".to_string(),
            message: "Cleaning up...".to_string(),
            percent: 97.0,
        });

        // Best-effort cleanup — don't fail the job if this errors
        if let Err(e) = self.delete_edit(&edit_id).await {
            log::info!("[Cleanvoice] Warning: failed to delete edit {}: {}", edit_id, e);
        }

        on_progress(CleanvoiceProgress {
            stage: "done".to_string(),
            message: "Enhancement complete".to_string(),
            percent: 100.0,
        });

        Ok(final_status)
    }
}
