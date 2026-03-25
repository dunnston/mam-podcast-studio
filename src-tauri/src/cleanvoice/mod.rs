use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

const BASE_URL: &str = "https://api.cleanvoice.ai/v2";

/// Cleanvoice API client
pub struct CleanvoiceClient {
    api_key: String,
    http: reqwest::Client,
}

// ─── Request / Response types ────────────────────────────────────

#[derive(Serialize)]
pub struct EditRequest {
    pub input: EditInput,
}

#[derive(Serialize)]
pub struct EditInput {
    pub files: Vec<String>,
    pub config: EditConfig,
}

#[derive(Serialize)]
pub struct EditConfig {
    /// AI studio sound enhancement ("nightly" for best quality, or true/false)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub studio_sound: Option<serde_json::Value>,
    /// Background noise removal
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remove_noise: Option<bool>,
    /// Volume normalization
    #[serde(skip_serializing_if = "Option::is_none")]
    pub normalize: Option<bool>,
    /// Target loudness in LUFS
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_lufs: Option<f64>,
    /// Remove filler words (um, uh, like)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fillers: Option<bool>,
    /// Remove mouth sounds (clicks, pops)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mouth_sounds: Option<bool>,
    /// Remove/reduce breathing
    #[serde(skip_serializing_if = "Option::is_none")]
    pub breath: Option<serde_json::Value>,
    /// Remove long silences / dead air
    #[serde(skip_serializing_if = "Option::is_none")]
    pub long_silences: Option<bool>,
    /// Output format: "auto", "mp3", "wav", "flac", "m4a"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub export_format: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct EditResponse {
    pub id: String,
}

#[derive(Deserialize, Debug, Clone, Serialize)]
pub struct EditStatus {
    pub status: String,
    pub result: Option<EditResult>,
}

#[derive(Deserialize, Debug, Clone, Serialize)]
pub struct EditResult {
    pub download_url: Option<String>,
    pub statistics: Option<serde_json::Value>,
    /// Progress percentage (0-100) while processing
    pub done: Option<f64>,
}

#[derive(Deserialize, Debug)]
pub struct UploadResponse {
    #[serde(alias = "signedUrl")]
    pub signed_url: String,
}

// ─── Client implementation ───────────────────────────────────────

impl CleanvoiceClient {
    pub fn new(api_key: &str) -> Self {
        Self {
            api_key: api_key.to_string(),
            http: reqwest::Client::new(),
        }
    }

    /// Test the API connection by hitting the health endpoint
    pub async fn test_connection(&self) -> Result<bool> {
        let resp = self
            .http
            .get(format!("{}/../../ping", BASE_URL))
            .header("X-API-Key", &self.api_key)
            .send()
            .await
            .context("Failed to connect to Cleanvoice API")?;

        Ok(resp.status().is_success())
    }

    /// Step 1: Request a signed upload URL
    pub async fn request_upload_url(&self, filename: &str) -> Result<String> {
        let resp = self
            .http
            .post(format!("{}/upload", BASE_URL))
            .header("X-API-Key", &self.api_key)
            .query(&[("filename", filename)])
            .send()
            .await
            .context("Failed to request upload URL")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Upload URL request failed ({}): {}", status, body);
        }

        let upload_resp: UploadResponse = resp
            .json()
            .await
            .context("Failed to parse upload URL response")?;

        Ok(upload_resp.signed_url)
    }

    /// Step 2: Upload file bytes to the signed URL
    pub async fn upload_file(&self, signed_url: &str, file_path: &Path) -> Result<()> {
        let file_bytes = tokio::fs::read(file_path)
            .await
            .context("Failed to read audio file")?;

        let resp = self
            .http
            .put(signed_url)
            .body(file_bytes)
            .send()
            .await
            .context("Failed to upload file to Cleanvoice")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("File upload failed ({}): {}", status, body);
        }

        Ok(())
    }

    /// Step 3: Submit an edit job
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

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Edit submission failed ({}): {}", status, body);
        }

        let edit_resp: EditResponse = resp
            .json()
            .await
            .context("Failed to parse edit response")?;

        Ok(edit_resp.id)
    }

    /// Step 4: Check the status of an edit job
    pub async fn get_edit_status(&self, edit_id: &str) -> Result<EditStatus> {
        let resp = self
            .http
            .get(format!("{}/edits/{}", BASE_URL, edit_id))
            .header("X-API-Key", &self.api_key)
            .send()
            .await
            .context("Failed to check edit status")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Status check failed ({}): {}", status, body);
        }

        let status: EditStatus = resp
            .json()
            .await
            .context("Failed to parse edit status")?;

        Ok(status)
    }

    /// Step 5: Download the processed audio to a local file
    pub async fn download_result(&self, download_url: &str, output_path: &Path) -> Result<()> {
        let resp = self
            .http
            .get(download_url)
            .send()
            .await
            .context("Failed to download processed audio")?;

        if !resp.status().is_success() {
            anyhow::bail!("Download failed with status: {}", resp.status());
        }

        let bytes = resp.bytes().await.context("Failed to read download bytes")?;
        tokio::fs::write(output_path, &bytes)
            .await
            .context("Failed to write downloaded audio")?;

        Ok(())
    }

    /// Convenience: Run the full enhancement pipeline
    /// Upload → Submit → Poll → Download
    pub async fn enhance_audio<F>(
        &self,
        input_path: &Path,
        output_path: &Path,
        config: EditConfig,
        on_progress: F,
    ) -> Result<EditStatus>
    where
        F: Fn(CleanvoiceProgress) + Send,
    {
        // Step 1: Get upload URL
        on_progress(CleanvoiceProgress {
            stage: "upload".to_string(),
            message: "Requesting upload URL...".to_string(),
            percent: 0.0,
        });

        let filename = input_path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "audio.wav".to_string());

        let signed_url = self.request_upload_url(&filename).await?;

        // Step 2: Upload file
        on_progress(CleanvoiceProgress {
            stage: "upload".to_string(),
            message: "Uploading audio to Cleanvoice...".to_string(),
            percent: 5.0,
        });

        self.upload_file(&signed_url, input_path).await?;

        on_progress(CleanvoiceProgress {
            stage: "upload".to_string(),
            message: "Upload complete".to_string(),
            percent: 15.0,
        });

        // Step 3: Submit edit
        on_progress(CleanvoiceProgress {
            stage: "processing".to_string(),
            message: "Submitting to Cleanvoice AI...".to_string(),
            percent: 18.0,
        });

        let request = EditRequest {
            input: EditInput {
                files: vec![signed_url],
                config,
            },
        };

        let edit_id = self.submit_edit(&request).await?;

        // Step 4: Poll for completion
        let mut poll_count = 0u32;
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            poll_count += 1;

            let status = self.get_edit_status(&edit_id).await?;

            match status.status.as_str() {
                "SUCCESS" => {
                    on_progress(CleanvoiceProgress {
                        stage: "processing".to_string(),
                        message: "Processing complete!".to_string(),
                        percent: 90.0,
                    });

                    // Step 5: Download result
                    if let Some(ref result) = status.result {
                        if let Some(ref url) = result.download_url {
                            on_progress(CleanvoiceProgress {
                                stage: "download".to_string(),
                                message: "Downloading enhanced audio...".to_string(),
                                percent: 92.0,
                            });

                            self.download_result(url, output_path).await?;

                            on_progress(CleanvoiceProgress {
                                stage: "done".to_string(),
                                message: "Enhancement complete".to_string(),
                                percent: 100.0,
                            });
                        }
                    }

                    return Ok(status);
                }
                "FAILURE" => {
                    anyhow::bail!(
                        "Cleanvoice processing failed: {:?}",
                        status.result
                    );
                }
                _ => {
                    // PENDING, STARTED, RETRY
                    let progress_pct = if let Some(ref result) = status.result {
                        result.done.unwrap_or(0.0)
                    } else {
                        0.0
                    };
                    // Map Cleanvoice 0-100% to our 20-90% range
                    let mapped = 20.0 + (progress_pct * 0.7);
                    on_progress(CleanvoiceProgress {
                        stage: "processing".to_string(),
                        message: format!(
                            "Cleanvoice AI processing... ({})",
                            status.status
                        ),
                        percent: mapped,
                    });

                    // Timeout after ~15 minutes (180 polls × 5 seconds)
                    if poll_count > 180 {
                        anyhow::bail!("Cleanvoice processing timed out after 15 minutes");
                    }
                }
            }
        }
    }
}

/// Progress update from the Cleanvoice pipeline
#[derive(Debug, Clone, Serialize)]
pub struct CleanvoiceProgress {
    pub stage: String,    // "upload", "processing", "download", "done"
    pub message: String,
    pub percent: f64,     // 0-100
}
