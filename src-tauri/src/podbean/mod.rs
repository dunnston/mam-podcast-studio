use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

const BASE_URL: &str = "https://api.podbean.com/v1";

/// Podbean API client — matches v1 REST API
pub struct PodbeanClient {
    client_id: String,
    client_secret: String,
    http: reqwest::Client,
}

// ─── Request / Response types ────────────────────────────────────

/// Response from POST /v1/oauth/token
#[derive(Deserialize, Debug, Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub scope: Option<String>,
}

/// Response from GET /v1/files/uploadAuthorize
#[derive(Deserialize, Debug)]
pub struct UploadAuthorizeResponse {
    pub presigned_url: String,
    pub file_key: String,
    pub expire_at: Option<u64>,
}

/// Response from GET /v1/podcasts
#[derive(Deserialize, Debug, Serialize, Clone)]
pub struct Podcast {
    pub id: Option<String>,
    pub title: Option<String>,
    pub link: Option<String>,
    pub logo_url: Option<String>,
}

/// Wrapper for podcast list response
#[derive(Deserialize, Debug)]
pub struct PodcastListResponse {
    pub podcasts: Vec<Podcast>,
}

/// Response from POST /v1/episodes (publish)
#[derive(Deserialize, Debug, Serialize)]
pub struct EpisodeResponse {
    pub episode: Option<EpisodeInfo>,
}

#[derive(Deserialize, Debug, Serialize)]
pub struct EpisodeInfo {
    pub id: Option<String>,
    pub title: Option<String>,
    pub permalink_url: Option<String>,
    pub media_url: Option<String>,
    pub status: Option<String>,
}

/// Progress callback for upload pipeline
#[derive(Debug, Clone, Serialize)]
pub struct PodbeanProgress {
    pub stage: String,   // "auth", "upload", "publish", "done"
    pub message: String,
    pub percent: f64,    // 0-100
}

// ─── Client implementation ───────────────────────────────────────

impl PodbeanClient {
    pub fn new(client_id: &str, client_secret: &str) -> Self {
        let http = reqwest::Client::builder()
            .user_agent("MAMPodcastStudio/1.0")
            .build()
            .expect("Failed to build HTTP client");

        Self {
            client_id: client_id.to_string(),
            client_secret: client_secret.to_string(),
            http,
        }
    }

    /// Step 0: Get an access token using client_credentials grant
    pub async fn authenticate(&self) -> Result<TokenResponse> {
        let resp = self
            .http
            .post(format!("{}/oauth/token", BASE_URL))
            .basic_auth(&self.client_id, Some(&self.client_secret))
            .form(&[("grant_type", "client_credentials")])
            .send()
            .await
            .context("Failed to connect to Podbean API")?;

        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            anyhow::bail!("Podbean authentication failed ({}): {}", status, body);
        }

        serde_json::from_str(&body)
            .with_context(|| format!("Failed to parse token response: {}", body))
    }

    /// Test connection by authenticating and returning token info
    pub async fn test_connection(&self) -> Result<TokenResponse> {
        self.authenticate().await
    }

    /// Get list of podcasts for the authenticated user
    pub async fn list_podcasts(&self, access_token: &str) -> Result<Vec<Podcast>> {
        let resp = self
            .http
            .get(format!("{}/podcasts", BASE_URL))
            .query(&[("access_token", access_token)])
            .send()
            .await
            .context("Failed to list podcasts")?;

        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            anyhow::bail!("Failed to list podcasts ({}): {}", status, body);
        }

        let parsed: PodcastListResponse = serde_json::from_str(&body)
            .with_context(|| format!("Failed to parse podcasts response: {}", body))?;

        Ok(parsed.podcasts)
    }

    /// Step 1: Authorize a file upload (get presigned URL + file_key)
    pub async fn authorize_upload(
        &self,
        access_token: &str,
        filename: &str,
        filesize: u64,
        content_type: &str,
    ) -> Result<UploadAuthorizeResponse> {
        let resp = self
            .http
            .get(format!("{}/files/uploadAuthorize", BASE_URL))
            .query(&[
                ("access_token", access_token),
                ("filename", filename),
                ("filesize", &filesize.to_string()),
                ("content_type", content_type),
            ])
            .send()
            .await
            .context("Failed to authorize upload")?;

        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        log::info!("[Podbean] Upload authorize response ({}): {}", status, body);

        if !status.is_success() {
            anyhow::bail!("Upload authorization failed ({}): {}", status, body);
        }

        serde_json::from_str(&body)
            .with_context(|| format!("Failed to parse upload authorize response: {}", body))
    }

    /// Step 2: Upload file bytes to the presigned URL
    pub async fn upload_file(&self, presigned_url: &str, file_path: &Path, content_type: &str) -> Result<()> {
        let file_bytes = tokio::fs::read(file_path)
            .await
            .context("Failed to read file for upload")?;

        let resp = self
            .http
            .put(presigned_url)
            .header("Content-Type", content_type)
            .body(file_bytes)
            .send()
            .await
            .context("Failed to upload file to Podbean storage")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("File upload failed ({}): {}", status, body);
        }

        Ok(())
    }

    /// Step 3: Publish an episode
    pub async fn publish_episode(
        &self,
        access_token: &str,
        title: &str,
        content: &str,
        media_key: &str,
        status: &str,      // "publish", "draft", "future"
        episode_type: &str, // "public", "premium", "private"
        logo_key: Option<&str>,
        publish_timestamp: Option<u64>,
    ) -> Result<EpisodeResponse> {
        let mut params = vec![
            ("access_token", access_token.to_string()),
            ("title", title.to_string()),
            ("content", content.to_string()),
            ("media_key", media_key.to_string()),
            ("status", status.to_string()),
            ("type", episode_type.to_string()),
        ];

        if let Some(logo) = logo_key {
            params.push(("logo_key", logo.to_string()));
        }

        if let Some(ts) = publish_timestamp {
            params.push(("publish_timestamp", ts.to_string()));
        }

        let resp = self
            .http
            .post(format!("{}/episodes", BASE_URL))
            .form(&params)
            .send()
            .await
            .context("Failed to publish episode")?;

        let resp_status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        log::info!("[Podbean] Publish response ({}): {}", resp_status, body);

        if !resp_status.is_success() {
            anyhow::bail!("Episode publish failed ({}): {}", resp_status, body);
        }

        serde_json::from_str(&body)
            .with_context(|| format!("Failed to parse publish response: {}", body))
    }

    /// Full pipeline: Authenticate → Upload → Publish
    pub async fn publish<F>(
        &self,
        audio_path: &Path,
        title: &str,
        content: &str,
        status: &str,
        on_progress: F,
    ) -> Result<EpisodeResponse>
    where
        F: Fn(PodbeanProgress) + Send,
    {
        // ── Step 0: Authenticate ─────────────────────────────────
        on_progress(PodbeanProgress {
            stage: "auth".to_string(),
            message: "Authenticating with Podbean...".to_string(),
            percent: 5.0,
        });

        let token = self.authenticate().await?;
        log::info!("[Podbean] Authenticated, scope: {:?}", token.scope);

        // ── Step 1: Authorize upload ─────────────────────────────
        on_progress(PodbeanProgress {
            stage: "upload".to_string(),
            message: "Requesting upload authorization...".to_string(),
            percent: 15.0,
        });

        let filename = audio_path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "episode.mp3".to_string());

        let file_meta = tokio::fs::metadata(audio_path)
            .await
            .context("Failed to read file metadata")?;

        let content_type = match audio_path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .as_deref()
        {
            Some("mp3") => "audio/mpeg",
            Some("m4a") => "audio/x-m4a",
            Some("ogg") => "audio/ogg",
            Some("wav") => "audio/wav",
            _ => "audio/mpeg",
        };

        let upload_auth = self
            .authorize_upload(&token.access_token, &filename, file_meta.len(), content_type)
            .await?;

        // ── Step 2: Upload file ──────────────────────────────────
        on_progress(PodbeanProgress {
            stage: "upload".to_string(),
            message: "Uploading audio to Podbean...".to_string(),
            percent: 30.0,
        });

        self.upload_file(&upload_auth.presigned_url, audio_path, content_type)
            .await?;

        on_progress(PodbeanProgress {
            stage: "upload".to_string(),
            message: "Upload complete".to_string(),
            percent: 75.0,
        });

        // ── Step 3: Publish episode ──────────────────────────────
        on_progress(PodbeanProgress {
            stage: "publish".to_string(),
            message: "Publishing episode...".to_string(),
            percent: 85.0,
        });

        let result = self
            .publish_episode(
                &token.access_token,
                title,
                content,
                &upload_auth.file_key,
                status,
                "public",
                None,
                None,
            )
            .await?;

        on_progress(PodbeanProgress {
            stage: "done".to_string(),
            message: "Episode published to Podbean!".to_string(),
            percent: 100.0,
        });

        Ok(result)
    }
}
