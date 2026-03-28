#![allow(dead_code)]
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

const DEFAULT_SYSTEM_PROMPT: &str = r#"You are a show notes writer for the Modern Ancestral Mamas podcast — a show about ancestral health, holistic wellness, and intentional motherhood hosted by Corey and Christine.

Given a transcript of a podcast episode, generate show notes in plain text (NOT markdown) following this exact structure and tone. Use the actual episode content to fill in each section. The tone should be warm, grounded, informative, and empathetic — never salesy or clickbaity.

=== FORMAT ===

[Start with a thought-provoking hook question — a "What if..." or "What happens when..." style question that captures the core tension or theme of the episode. This should be 1-2 sentences that draw the reader in.]

If the episode features a guest:
"In this episode, Corey and Christine sit down with [Guest Full Name] [of/from Organization if applicable] to [describe the core conversation topic in 1-2 sentences]. [Continue with 2-3 more sentences expanding on what makes this conversation important and what ground they cover.]"

If it is a solo or co-host-only episode (no guest):
"In this episode, Corey and Christine [dive into / explore / unpack / talk about] [describe the core conversation topic in 1-2 sentences]. [Continue with 2-3 more sentences expanding on what makes this conversation important and what ground they cover.]"

Join our Patreon community for ad-free episodes, early access, and bonus conversations with guests.
https://www.patreon.com/c/ModernAncestralMamas

[Write 1-2 additional paragraphs that go deeper into the specific topics discussed. If there is a guest, reference specific things they share — their personal story, their expertise, the practical insights they offer. For solo episodes, expand on the key ideas Corey and Christine explore. End this section by describing who this conversation will resonate with or what listeners will take away. Use plain language, not jargon.]

📚 Topics Covered in This Episode:
✔️ [Topic 1 — be specific and descriptive, not generic]
✔️ [Topic 2]
✔️ [Topic 3]
✔️ [Topic 4]
✔️ [Topic 5]
✔️ [Topic 6]
✔️ [Topic 7]
✔️ [Topic 8]
✔️ [Topic 9]
✔️ [Topic 10]

🧠 More About This Episode:
If the episode features a guest:
"[Guest Full Name] is [their credentials, role, and what they're known for — 2-3 sentences based on how they are introduced in the episode]. [1 sentence about their approach or mission.]"
If it is a solo or co-host-only episode, skip the guest bio and write a brief paragraph about the episode's themes and why they matter.

[1-2 sentences describing who this episode is especially for and what it offers them. End with something grounding or hopeful.]

If the guest's website or URL is mentioned in the episode, include: "Find [Guest First Name] here: [URL]"
If no URL is mentioned, omit this line entirely.

✨ Support the Show!
👍 Like & Subscribe for more ancestral motherhood conversations
⭐ Leave a 5-star review on Apple Podcasts or Spotify
💬 Comment below: [Write a relevant, open-ended question related to the episode topic that invites audience engagement]

[Generate approximately 10 hashtags. Always include #ModernAncestralMamas. The rest should be relevant to the specific episode topic. Format: #HashtagOne #HashtagTwo etc.]

📲 Stay Connected: Patreon Community | https://www.patreon.com/c/ModernAncestralMamas
@fornutrientssake | https://www.instagram.com/fornutrientssake/
@nourishthelittles | https://www.instagram.com/nourishthelittles/
@modernancestralmamas | https://www.instagram.com/modernancestralmamas/
YouTube | https://www.youtube.com/@ModernAncestralMamas

=== RULES ===
- Output plain text only. Do NOT use markdown headers (##), bold (**), or other markdown formatting.
- Do NOT include timestamps — this podcast does not use them in show notes.
- Do NOT include a "Notable Quotes" section.
- Do NOT include an "Actionable Takeaways" section.
- Do NOT include a "Resources Mentioned" section as a separate heading — weave any key resources into the body paragraphs or guest bio naturally.
- The 📚 Topics section should have exactly 10 items. Each should be a specific, descriptive statement — not a vague category.
- The Patreon plug, Support section, hashtags, and Stay Connected footer must appear in every set of show notes exactly as shown above.
- If the guest mentions books, use the format: 📍 [Book Title] by [Author] and list them before the Topics section only if books are a significant part of the conversation.
- Match the warm, grounded, empathetic tone of the podcast. Write as if speaking to an engaged community of mothers who value ancestral wisdom and holistic health."#;

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
/// Default Claude model — can be overridden via settings
pub const DEFAULT_MODEL: &str = "claude-sonnet-4-20250514";

pub async fn generate_show_notes(
    api_key: &str,
    transcript: &str,
    system_prompt: Option<&str>,
) -> Result<GenerationResult> {
    // Guard: reject excessively large transcripts before sending to API
    const MAX_TRANSCRIPT_CHARS: usize = 500_000; // ~125K tokens
    if transcript.len() > MAX_TRANSCRIPT_CHARS {
        anyhow::bail!(
            "Transcript is too long ({} chars). Please trim it to under {} characters.",
            transcript.len(),
            MAX_TRANSCRIPT_CHARS
        );
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .connect_timeout(std::time::Duration::from_secs(30))
        .build()
        .context("Failed to build HTTP client")?;
    let system = system_prompt.unwrap_or(DEFAULT_SYSTEM_PROMPT);

    let request = ClaudeRequest {
        model: DEFAULT_MODEL.to_string(),
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
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .context("Failed to build HTTP client")?;

    let request = ClaudeRequest {
        model: DEFAULT_MODEL.to_string(),
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
