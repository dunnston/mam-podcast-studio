use serde::{Deserialize, Serialize};

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
