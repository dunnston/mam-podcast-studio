import { useState, useEffect, useRef } from "react";
import {
  Cpu,
  Sparkles,
  Check,
  CheckCircle2,
  X,
  Zap,
  Wind,
  Layers,
} from "lucide-react";
import { useEpisodeStore } from "../../stores/episodeStore";
import {
  enhanceAudio,
  cancelProcessing,
  onEnhancementProgress,
} from "../../lib/tauri";
import type { ProcessingProgress } from "../../lib/tauri";
import { useSettingsStore } from "../../stores/settingsStore";
import { Button } from "../../components/ui/Button";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Badge } from "../../components/ui/Badge";

interface Preset {
  id: string;
  label: string;
  description: string;
  detail: string;
  icon: React.ReactNode;
}

const PRESETS: Preset[] = [
  {
    id: "light",
    label: "Light Touch",
    description: "Minimal processing",
    detail: "Gentle cleanup — subtle noise reduction and light normalization. Best for clean recordings.",
    icon: <Wind size={18} />,
  },
  {
    id: "standard",
    label: "Standard",
    description: "Recommended for most episodes",
    detail: "Balanced noise reduction, compression, and EQ. The right choice for most podcast recordings.",
    icon: <Zap size={18} />,
  },
  {
    id: "heavy",
    label: "Heavy",
    description: "Aggressive processing",
    detail: "Strong noise reduction, heavy compression, and loudness normalization. For noisy recordings.",
    icon: <Layers size={18} />,
  },
];

function formatEta(seconds?: number): string {
  if (!seconds) return "";
  if (seconds < 60) return `${Math.round(seconds)}s remaining`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s remaining`;
}

export function EnhanceStep() {
  const {
    currentEpisode,
    videoInfo,
    enhancementPreset,
    setEnhancementPreset,
    setCurrentStep,
    isProcessing,
    processingProgress,
    processingEta,
    setProcessing,
    setProgress,
  } = useEpisodeStore();

  const { outputDirectory } = useSettingsStore();
  const [method, setMethod] = useState<"ffmpeg" | "ai">("ffmpeg");
  const [progressDetail, setProgressDetail] = useState<ProcessingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [enhancedPath, setEnhancedPath] = useState<string | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  // Subscribe to enhancement progress events
  useEffect(() => {
    let active = true;
    onEnhancementProgress((progress) => {
      if (!active) return;
      setProgressDetail(progress);
      setProgress(progress.percent, progress.eta_seconds ? formatEta(progress.eta_seconds) : "");
    }).then((unlisten) => {
      unlistenRef.current = unlisten;
    });
    return () => {
      active = false;
      unlistenRef.current?.();
    };
  }, [setProgress]);

  const handleEnhance = async () => {
    if (!currentEpisode?.original_video_path || !videoInfo) return;

    const inputPath = currentEpisode.original_video_path;
    const dir = outputDirectory || ".";
    const episodeName = `MAM-${currentEpisode.episode_number || "episode"}-enhanced`;
    const outputPath = `${dir}/${episodeName}.mp4`;

    setError(null);
    setProcessing(true);
    setProgress(0);

    try {
      const result = await enhanceAudio(
        inputPath,
        outputPath,
        enhancementPreset,
        videoInfo.duration_seconds
      );
      setEnhancedPath(result);
      setCompleted(true);
    } catch (err) {
      if (err instanceof Error && err.message.includes("cancelled")) {
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Enhancement failed.");
      }
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelProcessing();
    } catch {
      // ignore
    }
  };

  const handleContinue = () => {
    setCurrentStep("extract");
  };

  const handleSkip = () => {
    setCurrentStep("extract");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Method selector */}
      <div>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "11px",
            fontWeight: "600",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            marginBottom: "12px",
          }}
        >
          Enhancement Method
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* FFmpeg card */}
          <button
            onClick={() => setMethod("ffmpeg")}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              padding: "18px 20px",
              backgroundColor: "var(--color-surface)",
              border: `1px solid ${method === "ffmpeg" ? "var(--color-sage)" : "var(--color-border)"}`,
              borderRadius: "12px",
              cursor: "pointer",
              textAlign: "left",
              transition: "border-color 150ms ease",
              boxShadow:
                method === "ffmpeg" ? "0 0 0 1px var(--color-sage)" : "none",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor:
                  method === "ffmpeg"
                    ? "rgba(122, 139, 111, 0.15)"
                    : "var(--color-surface-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color:
                  method === "ffmpeg"
                    ? "var(--color-sage)"
                    : "var(--color-text-muted)",
                flexShrink: 0,
                transition: "background-color 150ms ease, color 150ms ease",
              }}
            >
              <Cpu size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "4px",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "var(--color-cream)",
                  }}
                >
                  FFmpeg (Built-in)
                </span>
                <Badge variant="success">Recommended</Badge>
                {method === "ffmpeg" && (
                  <Check size={14} style={{ color: "var(--color-sage)", marginLeft: "auto" }} />
                )}
              </div>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                  lineHeight: "1.5",
                }}
              >
                Free, built-in audio processing. No API keys required.
              </p>
            </div>
          </button>

          {/* AI card (disabled) */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              padding: "18px 20px",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
              opacity: 0.5,
              cursor: "not-allowed",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: "var(--color-surface-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-text-muted)",
                flexShrink: 0,
              }}
            >
              <Sparkles size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "4px",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "var(--color-cream)",
                  }}
                >
                  AI Enhancement
                </span>
                <Badge variant="coming-soon">Coming Soon</Badge>
              </div>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                  lineHeight: "1.5",
                }}
              >
                Cloud-based AI audio restoration and enhancement.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Preset selector */}
      <div>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "11px",
            fontWeight: "600",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            marginBottom: "12px",
          }}
        >
          Processing Preset
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
          {PRESETS.map((preset) => {
            const isSelected = enhancementPreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setEnhancementPreset(preset.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "18px",
                  backgroundColor: "var(--color-surface)",
                  border: `1px solid ${isSelected ? "var(--color-sage)" : "var(--color-border)"}`,
                  borderRadius: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 150ms ease, background-color 150ms ease",
                  boxShadow: isSelected ? "0 0 0 1px var(--color-sage)" : "none",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "var(--color-text-muted)";
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      "var(--color-surface-light)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "var(--color-border)";
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      "var(--color-surface)";
                  }
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      color: "var(--color-sage)",
                    }}
                  >
                    <Check size={14} />
                  </div>
                )}
                <div
                  style={{
                    color: isSelected
                      ? "var(--color-sage)"
                      : "var(--color-text-muted)",
                    transition: "color 150ms ease",
                  }}
                >
                  {preset.icon}
                </div>
                <div>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "var(--color-cream)",
                      marginBottom: "4px",
                    }}
                  >
                    {preset.label}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "12px",
                      color: "var(--color-text-muted)",
                      lineHeight: "1.5",
                    }}
                  >
                    {preset.detail}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "rgba(192, 57, 43, 0.12)",
            border: "1px solid rgba(192, 57, 43, 0.25)",
            borderRadius: "8px",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "#E57373",
          }}
        >
          {error}
        </div>
      )}

      {/* Processing state */}
      {isProcessing && (
        <div
          style={{
            padding: "20px",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <ProgressBar value={processingProgress} label="Enhancing audio..." />
          {progressDetail && (
            <div
              style={{
                display: "flex",
                gap: "20px",
                flexWrap: "wrap",
              }}
            >
              {[
                { label: "Processed", value: progressDetail.time_processed },
                { label: "Speed", value: progressDetail.speed },
                ...(processingEta
                  ? [{ label: "ETA", value: processingEta }]
                  : []),
              ].map((item) => (
                <div key={item.label}>
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "11px",
                      fontWeight: "600",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--color-text-muted)",
                      display: "block",
                      marginBottom: "2px",
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "13px",
                      color: "var(--color-cream)",
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={handleCancel}>
            Cancel Enhancement
          </Button>
        </div>
      )}

      {/* Completed state */}
      {completed && !isProcessing && (
        <div
          style={{
            padding: "20px",
            backgroundColor: "rgba(122, 139, 111, 0.08)",
            border: "1px solid rgba(122, 139, 111, 0.25)",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <CheckCircle2 size={24} style={{ color: "var(--color-sage)", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                fontWeight: "600",
                color: "var(--color-cream)",
                marginBottom: "2px",
              }}
            >
              Enhancement complete
            </p>
            {enhancedPath && (
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {enhancedPath}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "4px",
        }}
      >
        <button
          onClick={handleSkip}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--color-text-muted)",
            textDecoration: "underline",
          }}
        >
          Skip enhancement
        </button>

        <div style={{ display: "flex", gap: "10px" }}>
          {!isProcessing && !completed && (
            <Button
              variant="primary"
              size="lg"
              icon={<Cpu size={16} />}
              onClick={handleEnhance}
              disabled={!currentEpisode?.original_video_path}
            >
              Enhance Audio
            </Button>
          )}
          {completed && (
            <Button variant="primary" size="lg" onClick={handleContinue}>
              Continue to Extraction
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
