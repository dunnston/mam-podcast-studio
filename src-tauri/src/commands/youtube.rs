use crate::youtube::{YouTubeClient, YouTubeProgress};
use tauri::{AppHandle, Emitter};

// ─── OAuth flow ──────────────────────────────────────────────────

/// Start the YouTube OAuth flow: opens browser, listens for callback,
/// exchanges code for tokens, returns the token response.
#[tauri::command]
pub async fn youtube_oauth_start(
    client_id: String,
    client_secret: String,
) -> Result<serde_json::Value, String> {
    let client = YouTubeClient::new(&client_id, &client_secret);

    // Bind to a random available port on loopback using async TCP
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind loopback listener: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get listener address: {}", e))?
        .port();

    log::info!("[YouTube] OAuth listener on port {}", port);

    // Build auth URL and open in browser
    let auth_url = client.build_auth_url(port);
    log::info!("[YouTube] Opening auth URL: {}", auth_url);

    open::that(&auth_url)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    // Wait for callback with 2-minute timeout (async, no thread blocking)
    let code = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        async {
            let (mut stream, _) = listener.accept().await
                .map_err(|e| format!("Listener error: {}", e))?;

            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            let mut buf = [0u8; 16384];
            let n = stream.read(&mut buf).await.unwrap_or(0);
            let request = String::from_utf8_lossy(&buf[..n]).to_string();

            let code = extract_code_from_request(&request);

            let (status, body) = if code.is_some() {
                ("200 OK", "<html><body><h2>Authorization successful!</h2><p>You can close this tab and return to MAM Podcast Studio.</p></body></html>")
            } else {
                ("400 Bad Request", "<html><body><h2>Authorization failed</h2><p>No authorization code received. Please try again.</p></body></html>")
            };

            let response = format!(
                "HTTP/1.1 {}\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n{}",
                status, body
            );
            let _ = stream.write_all(response.as_bytes()).await;
            let _ = stream.flush().await;
            drop(stream);

            code.ok_or_else(|| "No authorization code in callback".to_string())
        }
    )
    .await
    .map_err(|_| "OAuth timeout: user did not complete authorization within 2 minutes".to_string())?
    .map_err(|e: String| e)?;

    log::info!("[YouTube] Got authorization code, exchanging for tokens...");

    // Exchange code for tokens
    let token = client
        .exchange_code(&code, port)
        .await
        .map_err(|e| e.to_string())?;

    log::info!("[YouTube] Got tokens, refresh_token present: {}", token.refresh_token.is_some());

    serde_json::to_value(&token).map_err(|e| e.to_string())
}

/// Refresh an expired access token
#[tauri::command]
pub async fn youtube_refresh_token(
    client_id: String,
    client_secret: String,
    refresh_token: String,
) -> Result<serde_json::Value, String> {
    let client = YouTubeClient::new(&client_id, &client_secret);
    let token = client
        .refresh_access_token(&refresh_token)
        .await
        .map_err(|e| e.to_string())?;

    serde_json::to_value(&token).map_err(|e| e.to_string())
}

// ─── Upload ──────────────────────────────────────────────────────

#[derive(serde::Deserialize, Debug)]
pub struct YouTubeUploadRequest {
    pub client_id: String,
    pub client_secret: String,
    pub refresh_token: String,
    pub video_path: String,
    pub title: String,
    pub description: String,
    pub tags: Option<Vec<String>>,
    pub privacy_status: Option<String>, // "public", "private", "unlisted"
    pub category_id: Option<String>,
    pub thumbnail_path: Option<String>,
}

#[derive(serde::Serialize, Debug)]
pub struct YouTubeUploadResult {
    pub video_id: Option<String>,
    pub channel_id: Option<String>,
    pub upload_status: Option<String>,
}

#[tauri::command]
pub async fn youtube_upload(
    app: AppHandle,
    request: YouTubeUploadRequest,
) -> Result<YouTubeUploadResult, String> {
    log::info!("[YouTube] Starting upload for: {}", request.title);

    let client = YouTubeClient::new(&request.client_id, &request.client_secret);

    // Refresh the access token first
    let _ = app.emit("youtube-progress", &YouTubeProgress {
        stage: "auth".to_string(),
        message: "Refreshing access token...".to_string(),
        percent: 2.0,
    });

    let token = client
        .refresh_access_token(&request.refresh_token)
        .await
        .map_err(|e| format!("Failed to refresh YouTube token: {}. You may need to re-authorize in Settings.", e))?;

    let video_path = std::path::PathBuf::from(&request.video_path);
    let thumbnail_path = request.thumbnail_path.as_ref().map(std::path::PathBuf::from);

    let app_clone = app.clone();
    let result = client
        .upload(
            &token.access_token,
            &video_path,
            &request.title,
            &request.description,
            request.tags.unwrap_or_default(),
            request.privacy_status.as_deref().unwrap_or("private"),
            request.category_id.as_deref().unwrap_or("22"), // "People & Blogs"
            thumbnail_path.as_deref(),
            move |progress: YouTubeProgress| {
                let _ = app_clone.emit("youtube-progress", &progress);
            },
        )
        .await
        .map_err(|e| e.to_string())?;

    let upload_result = YouTubeUploadResult {
        video_id: result.id,
        channel_id: result.snippet.and_then(|s| s.channel_id),
        upload_status: result.status.and_then(|s| s.upload_status),
    };

    Ok(upload_result)
}

// ─── Helpers ─────────────────────────────────────────────────────

/// Extract the `code` query parameter from an HTTP GET request
fn extract_code_from_request(request: &str) -> Option<String> {
    // Parse "GET /?code=XXXX&scope=... HTTP/1.1"
    let first_line = request.lines().next()?;
    let path = first_line.split_whitespace().nth(1)?;
    let query = path.split('?').nth(1)?;

    for param in query.split('&') {
        let mut parts = param.splitn(2, '=');
        if let (Some(key), Some(value)) = (parts.next(), parts.next()) {
            if key == "code" {
                // URL-decode the value
                return Some(url_decode(value));
            }
        }
    }

    None
}

/// URL decode — handles multi-byte UTF-8 percent-encoded sequences correctly.
fn url_decode(input: &str) -> String {
    let mut bytes = Vec::new();
    let input_bytes = input.as_bytes();
    let mut i = 0;
    while i < input_bytes.len() {
        if input_bytes[i] == b'%' && i + 2 < input_bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                &input[i + 1..i + 3],
                16,
            ) {
                bytes.push(byte);
                i += 3;
                continue;
            }
        } else if input_bytes[i] == b'+' {
            bytes.push(b' ');
            i += 1;
            continue;
        }
        bytes.push(input_bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&bytes).to_string()
}
