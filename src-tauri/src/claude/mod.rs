#![allow(dead_code)]
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

const DEFAULT_SYSTEM_PROMPT: &str = r#"You are a show notes writer for the Modern Ancestral Mamas podcast — a show about ancestral health, holistic wellness, and intentional motherhood hosted by Christine and Corey.

Given a transcript of a podcast episode, generate structured show notes following this template:

## Episode Title & Number
[Infer from context or use placeholder]

## Guest Bio
[If a guest is present, write a brief 2-3 sentence bio based on how they're introduced]

## Episode Summary
[Write 2-3 engaging paragraphs summarizing the episode's main discussion. Use a warm, knowledgeable, approachable tone that matches the MAM brand. Focus on what listeners will learn and why it matters.]

## Key Topics
[Bullet list of main topics discussed with approximate timestamps if discernible]

## Notable Quotes
[Pull 2-4 standout quotes from the conversation]

## Resources Mentioned
[List any products, books, websites, supplements, or resources mentioned]

## Actionable Takeaways
[3-5 practical tips or action items listeners can implement]

## Episode Description
[Write a compelling 2-3 sentence description optimized for podcast platform search. Include relevant keywords naturally.]

---
Subscribe to Modern Ancestral Mamas on Apple Podcasts, Spotify, and YouTube. Support us on Patreon for exclusive content!"#;

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaudeMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ClaudeRequest {
    pub model: String,
    pub max_tokens: u32,
    pub system: String,
    pub messages: Vec<ClaudeMessage>,
    pub stream: bool,
}

#[derive(Debug, Deserialize)]
pub struct ClaudeResponse {
    pub content: Vec<ContentBlock>,
    pub usage: Option<Usage>,
}

#[derive(Debug, Deserialize)]
pub struct ContentBlock {
    #[serde(rename = "type")]
    pub block_type: String,
    pub text: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Usage {
    pub input_tokens: u64,
    pub output_tokens: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerationResult {
    pub content: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub estimated_cost: f64,
}

pub fn get_default_system_prompt() -> &'static str {
    DEFAULT_SYSTEM_PROMPT
}

/// Generate show notes from a transcript using the Claude API (non-streaming)
pub async fn generate_show_notes(
    api_key: &str,
    transcript: &str,
    system_prompt: Option<&str>,
) -> Result<GenerationResult> {
    let client = reqwest::Client::new();
    let system = system_prompt.unwrap_or(DEFAULT_SYSTEM_PROMPT);

    let request = ClaudeRequest {
        model: "claude-sonnet-4-20250514".to_string(),
        max_tokens: 4096,
        system: system.to_string(),
        messages: vec![ClaudeMessage {
            role: "user".to_string(),
            content: format!(
                "Please generate show notes for the following podcast transcript:\n\n{}",
                transcript
            ),
        }],
        stream: false,
    };

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .context("Failed to send request to Claude API")?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("Claude API error ({}): {}", status, body);
    }

    let claude_response: ClaudeResponse = response
        .json()
        .await
        .context("Failed to parse Claude API response")?;

    let content = claude_response
        .content
        .iter()
        .filter_map(|block| block.text.as_ref())
        .cloned()
        .collect::<Vec<String>>()
        .join("\n");

    let usage = claude_response.usage.unwrap_or(Usage {
        input_tokens: 0,
        output_tokens: 0,
    });

    // Estimate cost (Sonnet pricing: $3/1M input, $15/1M output as of 2025)
    let estimated_cost = (usage.input_tokens as f64 * 3.0 / 1_000_000.0)
        + (usage.output_tokens as f64 * 15.0 / 1_000_000.0);

    Ok(GenerationResult {
        content,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        estimated_cost,
    })
}

/// Test Claude API connectivity with a minimal request
pub async fn test_connection(api_key: &str) -> Result<bool> {
    let client = reqwest::Client::new();

    let request = ClaudeRequest {
        model: "claude-sonnet-4-20250514".to_string(),
        max_tokens: 10,
        system: "Respond with OK".to_string(),
        messages: vec![ClaudeMessage {
            role: "user".to_string(),
            content: "Test".to_string(),
        }],
        stream: false,
    };

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .context("Failed to connect to Claude API")?;

    Ok(response.status().is_success())
}
