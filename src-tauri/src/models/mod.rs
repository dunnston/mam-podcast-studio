use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Episode {
    pub id: Option<i64>,
    pub episode_number: Option<i64>,
    pub title: String,
    pub recording_date: Option<String>,
    pub guest_names: Option<String>, // JSON array
    pub tags: Option<String>,        // JSON array
    pub original_video_path: Option<String>,
    pub enhanced_video_path: Option<String>,
    pub status: String, // draft | processing | enhanced | extracted | published
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioExport {
    pub id: Option<i64>,
    pub episode_id: i64,
    pub format: String, // mp3 | m4a | wav
    pub file_path: String,
    pub bitrate: Option<i64>,
    pub file_size_bytes: Option<i64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancementRun {
    pub id: Option<i64>,
    pub episode_id: i64,
    pub method: String, // ffmpeg | ai
    pub preset_name: Option<String>,
    pub settings_json: Option<String>,
    pub duration_seconds: Option<f64>,
    pub status: String, // pending | processing | completed | failed
    pub error_message: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShowNotes {
    pub id: Option<i64>,
    pub episode_id: i64,
    pub transcript_path: Option<String>,
    pub generated_content: Option<String>,
    pub edited_content: Option<String>,
    pub template_used: Option<String>,
    pub tokens_used: Option<i64>,
    pub version: i64,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoProbeResult {
    pub duration_seconds: f64,
    pub duration_display: String,
    pub video_codec: String,
    pub audio_codec: String,
    pub resolution: String,
    pub file_size_bytes: u64,
    pub file_size_display: String,
    pub bitrate: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancementPreset {
    pub name: String,
    pub description: String,
    pub noise_gate_threshold: f64,
    pub highpass_freq: f64,
    pub eq_low_mid_cut: f64,
    pub eq_presence_boost: f64,
    pub eq_air_boost: f64,
    pub comp_low_ratio: f64,
    pub comp_mid_ratio: f64,
    pub comp_high_ratio: f64,
    pub limiter_threshold: f64,
    pub target_lufs: f64,
}

impl EnhancementPreset {
    pub fn light() -> Self {
        Self {
            name: "Light Touch".into(),
            description: "Minimal processing - gentle cleanup".into(),
            noise_gate_threshold: -50.0,
            highpass_freq: 60.0,
            eq_low_mid_cut: -1.0,
            eq_presence_boost: 1.0,
            eq_air_boost: 0.5,
            comp_low_ratio: 2.0,
            comp_mid_ratio: 1.5,
            comp_high_ratio: 1.5,
            limiter_threshold: -1.0,
            target_lufs: -16.0,
        }
    }

    pub fn standard() -> Self {
        Self {
            name: "Standard".into(),
            description: "Recommended for most episodes".into(),
            noise_gate_threshold: -40.0,
            highpass_freq: 80.0,
            eq_low_mid_cut: -2.0,
            eq_presence_boost: 2.0,
            eq_air_boost: 1.0,
            comp_low_ratio: 3.0,
            comp_mid_ratio: 2.5,
            comp_high_ratio: 2.0,
            limiter_threshold: -1.0,
            target_lufs: -16.0,
        }
    }

    pub fn heavy() -> Self {
        Self {
            name: "Heavy".into(),
            description: "Aggressive noise reduction and compression".into(),
            noise_gate_threshold: -35.0,
            highpass_freq: 100.0,
            eq_low_mid_cut: -3.0,
            eq_presence_boost: 3.0,
            eq_air_boost: 1.5,
            comp_low_ratio: 4.0,
            comp_mid_ratio: 3.5,
            comp_high_ratio: 3.0,
            limiter_threshold: -0.5,
            target_lufs: -16.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingProgress {
    pub percent: f64,
    pub time_processed: String,
    pub speed: String,
    pub eta_seconds: Option<f64>,
}
