use crate::models::{EnhancementPreset, ProcessingProgress, VideoProbeResult};
use anyhow::{Context, Result};
use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

/// Probe a video file using ffprobe sidecar to get metadata
pub async fn probe_video(app: &AppHandle, video_path: &str) -> Result<VideoProbeResult> {
    let output = app
        .shell()
        .sidecar("ffprobe")
        .expect("failed to create ffprobe sidecar")
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            video_path,
        ])
        .output()
        .await
        .context("Failed to run ffprobe")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("ffprobe failed: {}", stderr);
    }

    let json: Value = serde_json::from_slice(&output.stdout)
        .context("Failed to parse ffprobe output")?;

    let format = &json["format"];
    let duration: f64 = format["duration"]
        .as_str()
        .unwrap_or("0")
        .parse()
        .unwrap_or(0.0);

    let file_size: u64 = format["size"]
        .as_str()
        .unwrap_or("0")
        .parse()
        .unwrap_or(0);

    let bitrate: Option<u64> = format["bit_rate"]
        .as_str()
        .and_then(|s| s.parse().ok());

    let streams = json["streams"].as_array();
    let mut video_codec = String::from("unknown");
    let mut audio_codec = String::from("unknown");
    let mut resolution = String::from("unknown");

    if let Some(streams) = streams {
        for stream in streams {
            let codec_type = stream["codec_type"].as_str().unwrap_or("");
            match codec_type {
                "video" => {
                    video_codec = stream["codec_name"]
                        .as_str()
                        .unwrap_or("unknown")
                        .to_string();
                    let width = stream["width"].as_u64().unwrap_or(0);
                    let height = stream["height"].as_u64().unwrap_or(0);
                    resolution = format!("{}x{}", width, height);
                }
                "audio" => {
                    audio_codec = stream["codec_name"]
                        .as_str()
                        .unwrap_or("unknown")
                        .to_string();
                }
                _ => {}
            }
        }
    }

    let hours = (duration / 3600.0) as u64;
    let minutes = ((duration % 3600.0) / 60.0) as u64;
    let seconds = (duration % 60.0) as u64;
    let duration_display = if hours > 0 {
        format!("{}:{:02}:{:02}", hours, minutes, seconds)
    } else {
        format!("{}:{:02}", minutes, seconds)
    };

    let file_size_display = format_file_size(file_size);

    Ok(VideoProbeResult {
        duration_seconds: duration,
        duration_display,
        video_codec,
        audio_codec,
        resolution,
        file_size_bytes: file_size,
        file_size_display,
        bitrate,
    })
}

/// Build FFmpeg filter chain from an enhancement preset
pub fn build_filter_chain(preset: &EnhancementPreset) -> String {
    let filters = vec![
        // 1. Noise Gate
        format!(
            "agate=threshold={}:attack=10:release=200",
            db_to_linear(preset.noise_gate_threshold)
        ),
        // 2. High-Pass Filter
        format!("highpass=f={}:poles=2", preset.highpass_freq),
        // 3. De-esser (band-specific compression on sibilance range)
        "firequalizer=gain_entry='entry(4000,0);entry(5000,-4);entry(8000,-4);entry(9000,0)'".to_string(),
        // 4. Parametric EQ
        format!(
            "firequalizer=gain_entry='entry(200,0);entry(300,{});entry(400,0);entry(2000,0);entry(3500,{});entry(5000,0);entry(10000,0);entry(12000,{});entry(20000,{})'",
            preset.eq_low_mid_cut, preset.eq_presence_boost, preset.eq_air_boost, preset.eq_air_boost
        ),
        // 5. Multiband compression (simulated with 3 parallel bands)
        format!(
            "compand=attacks=0.02:decays=0.15:points=-80/-80|-{}/-{}|0/-{}:gain=2",
            preset.comp_mid_ratio * 10.0,
            preset.comp_mid_ratio * 4.0,
            preset.comp_mid_ratio * 2.0
        ),
        // 6. Limiter
        format!("alimiter=limit={}:attack=5:release=50", db_to_linear(preset.limiter_threshold)),
        // 7. Loudness normalization to target LUFS
        format!(
            "loudnorm=I={}:TP=-1.5:LRA=11:print_format=summary",
            preset.target_lufs
        ),
    ];

    filters.join(",")
}

/// Parse FFmpeg progress from stderr line
pub fn parse_progress(line: &str, total_duration: f64) -> Option<ProcessingProgress> {
    if !line.contains("time=") {
        return None;
    }

    let time = extract_value(line, "time=")?;
    let time_seconds = parse_time_to_seconds(&time)?;
    let speed = extract_value(line, "speed=").unwrap_or_else(|| "0x".to_string());

    let percent = if total_duration > 0.0 {
        (time_seconds / total_duration * 100.0).min(100.0)
    } else {
        0.0
    };

    let speed_multiplier: f64 = speed.trim_end_matches('x').parse().unwrap_or(1.0);
    let remaining = total_duration - time_seconds;
    let eta_seconds = if speed_multiplier > 0.0 {
        Some(remaining / speed_multiplier)
    } else {
        None
    };

    let hours = (time_seconds / 3600.0) as u64;
    let minutes = ((time_seconds % 3600.0) / 60.0) as u64;
    let secs = (time_seconds % 60.0) as u64;
    let time_processed = format!("{:02}:{:02}:{:02}", hours, minutes, secs);

    Some(ProcessingProgress {
        percent,
        time_processed,
        speed,
        eta_seconds,
    })
}

fn extract_value(line: &str, key: &str) -> Option<String> {
    let start = line.find(key)? + key.len();
    let rest = &line[start..];
    let end = rest.find(|c: char| c.is_whitespace()).unwrap_or(rest.len());
    Some(rest[..end].to_string())
}

fn parse_time_to_seconds(time: &str) -> Option<f64> {
    let parts: Vec<&str> = time.split(':').collect();
    if parts.len() == 3 {
        let h: f64 = parts[0].parse().ok()?;
        let m: f64 = parts[1].parse().ok()?;
        let s: f64 = parts[2].parse().ok()?;
        Some(h * 3600.0 + m * 60.0 + s)
    } else {
        None
    }
}

fn db_to_linear(db: f64) -> f64 {
    10.0_f64.powf(db / 20.0)
}

fn format_file_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}
