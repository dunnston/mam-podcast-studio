use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const UPLOAD_URL: &str = "https://www.googleapis.com/upload/youtube/v3/videos";
const THUMBNAIL_URL: &str = "https://www.googleapis.com/upload/youtube/v3/thumbnails/set";

/// YouTube API client — OAuth 2.0 + Data API v3
pub struct YouTubeClient {
    client_id: String,
    client_secret: String,
    http: reqwest::Client,
}

// ─── OAuth types ─────────────────────────────────────────────────

#[derive(Deserialize, Debug, Serialize, Clone)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
}

#[derive(Deserialize, Debug, Serialize)]
pub struct TokenError {
    pub error: Option<String>,
    pub error_description: Option<String>,
}

// ─── Upload types ────────────────────────────────────────────────

#[derive(Serialize, Debug)]
pub struct VideoMetadata {
    pub snippet: VideoSnippet,
    pub status: VideoStatus,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VideoSnippet {
    pub title: String,
    pub description: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    pub category_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_language: Option<String>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VideoStatus {
    pub privacy_status: String, // "public", "private", "unlisted"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub self_declared_made_for_kids: Option<bool>,
}

#[derive(Deserialize, Debug, Serialize)]
pub struct VideoResponse {
    pub id: Option<String>,
    pub snippet: Option<VideoSnippetResponse>,
    pub status: Option<VideoStatusResponse>,
}

#[derive(Deserialize, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoSnippetResponse {
    pub title: Option<String>,
    pub channel_id: Option<String>,
}

#[derive(Deserialize, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoStatusResponse {
    pub upload_status: Option<String>,
    pub privacy_status: Option<String>,
}

/// Progress callback for upload pipeline
#[derive(Debug, Clone, Serialize)]
pub struct YouTubeProgress {
    pub stage: String,   // "auth", "upload", "thumbnail", "done"
    pub message: String,
    pub percent: f64,    // 0-100
}

// ─── Client implementation ───────────────────────────────────────

impl YouTubeClient {
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

    /// Build the OAuth authorization URL that the user opens in their browser.
    /// Returns (auth_url, redirect_port) — the app listens on redirect_port for the callback.
    pub fn build_auth_url(&self, redirect_port: u16) -> String {
        let redirect_uri = format!("http://127.0.0.1:{}", redirect_port);
        format!(
            "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
            AUTH_URL,
            urlencoding::encode(&self.client_id),
            urlencoding::encode(&redirect_uri),
            urlencoding::encode("https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube"),
        )
    }

    /// Exchange an authorization code for access + refresh tokens
    pub async fn exchange_code(&self, code: &str, redirect_port: u16) -> Result<TokenResponse> {
        let redirect_uri = format!("http://127.0.0.1:{}", redirect_port);

        let resp = self
            .http
            .post(TOKEN_URL)
            .form(&[
                ("client_id", self.client_id.as_str()),
                ("client_secret", self.client_secret.as_str()),
                ("code", code),
                ("grant_type", "authorization_code"),
                ("redirect_uri", redirect_uri.as_str()),
            ])
            .send()
            .await
            .context("Failed to exchange authorization code")?;

        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            let err: TokenError = serde_json::from_str(&body).unwrap_or(TokenError {
                error: Some(status.to_string()),
                error_description: Some(body.clone()),
            });
            anyhow::bail!(
                "Token exchange failed: {} - {}",
                err.error.unwrap_or_default(),
                err.error_description.unwrap_or_default()
            );
        }

        serde_json::from_str(&body)
            .with_context(|| format!("Failed to parse token response: {}", body))
    }

    /// Refresh an access token using a stored refresh token
    pub async fn refresh_access_token(&self, refresh_token: &str) -> Result<TokenResponse> {
        let resp = self
            .http
            .post(TOKEN_URL)
            .form(&[
                ("client_id", self.client_id.as_str()),
                ("client_secret", self.client_secret.as_str()),
                ("refresh_token", refresh_token),
                ("grant_type", "refresh_token"),
            ])
            .send()
            .await
            .context("Failed to refresh access token")?;

        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();

        if !status.is_success() {
            anyhow::bail!("Token refresh failed ({}): {}", status, body);
        }

        let mut token: TokenResponse = serde_json::from_str(&body)
            .with_context(|| format!("Failed to parse refresh response: {}", body))?;

        // Refresh responses don't include a new refresh_token, so preserve the old one
        if token.refresh_token.is_none() {
            token.refresh_token = Some(refresh_token.to_string());
        }

        Ok(token)
    }

    /// Initiate a resumable upload session and return the upload URI
    async fn initiate_upload(
        &self,
        access_token: &str,
        metadata: &VideoMetadata,
        file_size: u64,
        content_type: &str,
    ) -> Result<String> {
        let metadata_json = serde_json::to_string(metadata)
            .context("Failed to serialize video metadata")?;

        let resp = self
            .http
            .post(format!("{}?uploadType=resumable&part=snippet,status", UPLOAD_URL))
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json; charset=UTF-8")
            .header("X-Upload-Content-Length", file_size.to_string())
            .header("X-Upload-Content-Type", content_type)
            .body(metadata_json)
            .send()
            .await
            .context("Failed to initiate resumable upload")?;

        let status = resp.status();

        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Upload initiation failed ({}): {}", status, body);
        }

        // The upload URI is in the Location header
        let upload_uri = resp
            .headers()
            .get("location")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .context("No Location header in upload initiation response")?;

        Ok(upload_uri)
    }

    /// Upload the video file to the resumable upload URI (streamed to avoid buffering)
    async fn upload_video_bytes(
        &self,
        upload_uri: &str,
        file_path: &Path,
        content_type: &str,
    ) -> Result<VideoResponse> {
        let file = tokio::fs::File::open(file_path)
            .await
            .context("Failed to open video file")?;
        let file_len = file
            .metadata()
            .await
            .context("Failed to read video file metadata")?
            .len();

        let stream = tokio_util::io::ReaderStream::new(file);
        let body = reqwest::Body::wrap_stream(stream);

        let resp = self
            .http
            .put(upload_uri)
            .header("Content-Type", content_type)
            .header("Content-Length", file_len.to_string())
            .body(body)
            .send()
            .await
            .context("Failed to upload video bytes")?;

        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        eprintln!("[YouTube] Upload response ({}): {}", status, &body[..body.len().min(500)]);

        if !status.is_success() {
            anyhow::bail!("Video upload failed ({}): {}", status, body);
        }

        serde_json::from_str(&body)
            .with_context(|| format!("Failed to parse upload response: {}", body))
    }

    /// Upload a thumbnail image for a video
    pub async fn set_thumbnail(
        &self,
        access_token: &str,
        video_id: &str,
        image_path: &Path,
    ) -> Result<()> {
        let image_bytes = tokio::fs::read(image_path)
            .await
            .context("Failed to read thumbnail image")?;

        let content_type = match image_path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .as_deref()
        {
            Some("png") => "image/png",
            Some("jpg") | Some("jpeg") => "image/jpeg",
            _ => "image/jpeg",
        };

        let resp = self
            .http
            .post(format!("{}?videoId={}", THUMBNAIL_URL, video_id))
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", content_type)
            .body(image_bytes)
            .send()
            .await
            .context("Failed to upload thumbnail")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Thumbnail upload failed ({}): {}", status, body);
        }

        Ok(())
    }

    /// Full pipeline: Upload video → Set thumbnail (optional)
    pub async fn upload<F>(
        &self,
        access_token: &str,
        video_path: &Path,
        title: &str,
        description: &str,
        tags: Vec<String>,
        privacy_status: &str,
        category_id: &str,
        thumbnail_path: Option<&Path>,
        on_progress: F,
    ) -> Result<VideoResponse>
    where
        F: Fn(YouTubeProgress) + Send,
    {
        // ── Step 1: Initiate resumable upload ────────────────────
        on_progress(YouTubeProgress {
            stage: "upload".to_string(),
            message: "Preparing video upload...".to_string(),
            percent: 5.0,
        });

        let metadata = VideoMetadata {
            snippet: VideoSnippet {
                title: title.to_string(),
                description: description.to_string(),
                tags,
                category_id: category_id.to_string(),
                default_language: Some("en".to_string()),
            },
            status: VideoStatus {
                privacy_status: privacy_status.to_string(),
                self_declared_made_for_kids: Some(false),
            },
        };

        let file_meta = tokio::fs::metadata(video_path)
            .await
            .context("Failed to read video file metadata")?;

        let content_type = match video_path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .as_deref()
        {
            Some("mp4") => "video/mp4",
            Some("mov") => "video/quicktime",
            Some("mkv") => "video/x-matroska",
            Some("avi") => "video/x-msvideo",
            Some("webm") => "video/webm",
            _ => "video/mp4",
        };

        let upload_uri = self
            .initiate_upload(access_token, &metadata, file_meta.len(), content_type)
            .await?;

        eprintln!("[YouTube] Got upload URI, uploading {} bytes...", file_meta.len());

        // ── Step 2: Upload video bytes ───────────────────────────
        on_progress(YouTubeProgress {
            stage: "upload".to_string(),
            message: format!("Uploading video ({:.0} MB)...", file_meta.len() as f64 / 1_048_576.0),
            percent: 15.0,
        });

        let video_resp = self
            .upload_video_bytes(&upload_uri, video_path, content_type)
            .await?;

        let video_id = video_resp.id.clone().unwrap_or_default();
        eprintln!("[YouTube] Video uploaded, ID: {}", video_id);

        on_progress(YouTubeProgress {
            stage: "upload".to_string(),
            message: "Video upload complete".to_string(),
            percent: 80.0,
        });

        // ── Step 3: Set thumbnail (optional) ─────────────────────
        if let Some(thumb_path) = thumbnail_path {
            if !video_id.is_empty() {
                on_progress(YouTubeProgress {
                    stage: "thumbnail".to_string(),
                    message: "Uploading thumbnail...".to_string(),
                    percent: 85.0,
                });

                self.set_thumbnail(access_token, &video_id, thumb_path).await?;

                on_progress(YouTubeProgress {
                    stage: "thumbnail".to_string(),
                    message: "Thumbnail set".to_string(),
                    percent: 95.0,
                });
            }
        }

        on_progress(YouTubeProgress {
            stage: "done".to_string(),
            message: format!("Video published to YouTube! ID: {}", video_id),
            percent: 100.0,
        });

        Ok(video_resp)
    }
}

/// URL-encode a string (minimal implementation for auth URLs)
mod urlencoding {
    pub fn encode(input: &str) -> String {
        let mut result = String::new();
        for byte in input.bytes() {
            match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    result.push(byte as char);
                }
                _ => {
                    result.push('%');
                    result.push_str(&format!("{:02X}", byte));
                }
            }
        }
        result
    }
}
