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
  FolderOpen,
  Loader2,
} from "lucide-react";
import { useEpisodeStore } from "../../stores/episodeStore";
import {
  enhanceAudio,
  cancelProcessing,
  onEnhancementProgress,
  cleanvoiceEnhance,
  cleanvoiceCancel,
  onCleanvoiceProgress,
  onCleanvoiceTranscript,
} from "../../lib/tauri";
import { updateEpisode } from "../../lib/database";
import type { ProcessingProgress } from "../../lib/tauri";
import { useSettingsStore } from "../../stores/settingsStore";
import { Button } from "../../components/ui/Button";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Badge } from "../../components/ui/Badge";

// ─── Presets ─────────────────────────────────────────────────────

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

// ─── Cleanvoice presets ─────────────────────────────────────────

interface CleanvoicePreset {
  id: string;
  label: string;
  detail: string;
  config: {
    remove_noise?: boolean;
    studio_sound?: boolean | string;
    normalize?: boolean;
    fillers?: boolean;
    long_silences?: boolean;
    mouth_sounds?: boolean;
    breath?: boolean | string;
    stutters?: boolean;
    hesitations?: boolean;
  };
}

const CV_PRESETS: CleanvoicePreset[] = [
  {
    id: "enhance",
    label: "Enhance Only",
    detail: "Studio sound, noise removal, and normalization. No content cuts. Fastest upload (audio only).",
    config: {
      remove_noise: true,
      studio_sound: true,
      normalize: true,
    },
  },
  {
    id: "enhance-edit",
    label: "Enhance + Edit",
    detail: "Full enhancement plus filler word, stutter, silence, and mouth sound removal. Sends video for timeline cuts.",
    config: {
      remove_noise: true,
      studio_sound: true,
      normalize: true,
      fillers: true,
      long_silences: true,
      mouth_sounds: true,
      stutters: true,
    },
  },
  {
    id: "full",
    label: "Full Podcast Edit",
    detail: "Everything — enhancement, all editing features, and breath reduction. The most aggressive option.",
    config: {
      remove_noise: true,
      studio_sound: true,
      normalize: true,
      fillers: true,
      long_silences: true,
      mouth_sounds: true,
      breath: true,
      stutters: true,
      hesitations: true,
    },
  },
];

function formatEta(seconds?: number): string {
  if (!seconds) return "";
  if (seconds < 60) return `${Math.round(seconds)}s remaining`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s remaining`;
}

// ─── Component ──────────────────────────────────────────────────

export function EnhanceStep() {
  const {
    currentEpisode,
    videoInfo,
    enhancementPreset,
    setEnhancementPreset,
    setCurrentStep,
    setCurrentEpisode,
    setCleanvoiceTranscript,
    isProcessing,
    processingProgress,
    processingEta,
    setProcessing,
    setProgress,
    wizardSessionId,
  } = useEpisodeStore();

  const { enhancedVideoDirectory, aiEnhancementApiKey } = useSettingsStore();

  // Two-stage toggles
  const [enableCleanvoice, setEnableCleanvoice] = useState(true);
  const [enableMastering, setEnableMastering] = useState(true);

  // Cleanvoice preset
  const [cvPreset, setCvPreset] = useState("enhance-edit");

  // Processing state
  const [currentStage, setCurrentStage] = useState<"idle" | "cleanvoice" | "mastering" | "muxing">("idle");
  const [cleanvoiceMessage, setCleanvoiceMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [enhancedPath, setEnhancedPath] = useState<string | null>(null);
  const [progressDetail, setProgressDetail] = useState<ProcessingProgress | null>(null);

  const unlistenFfmpegRef = useRef<(() => void) | null>(null);
  const unlistenCvRef = useRef<(() => void) | null>(null);
  const unlistenTranscriptRef = useRef<(() => void) | null>(null);

  // If episode already enhanced, show completed state
  useEffect(() => {
    if (currentEpisode?.enhanced_video_path && currentEpisode?.status === "enhanced") {
      setCompleted(true);
      setEnhancedPath(currentEpisode.enhanced_video_path);
    }
  }, [currentEpisode]);

  // Subscribe to FFmpeg progress events
  useEffect(() => {
    let active = true;
    onEnhancementProgress((progress) => {
      if (!active) return;
      setProgressDetail(progress);
      setProgress(progress.percent, progress.eta_seconds ? formatEta(progress.eta_seconds) : "");
    }).then((unlisten) => {
      unlistenFfmpegRef.current = unlisten;
    });
    return () => {
      active = false;
      unlistenFfmpegRef.current?.();
    };
  }, [setProgress]);

  // Subscribe to Cleanvoice progress events
  useEffect(() => {
    let active = true;
    onCleanvoiceProgress((progress) => {
      if (!active) return;
      setCleanvoiceMessage(progress.message);
      setProgress(progress.percent, "");
    }).then((unlisten) => {
      unlistenCvRef.current = unlisten;
    });
    return () => {
      active = false;
      unlistenCvRef.current?.();
    };
  }, [setProgress]);

  // Subscribe to Cleanvoice transcript event
  useEffect(() => {
    let active = true;
    onCleanvoiceTranscript((transcript) => {
      if (!active) return;
      setCleanvoiceTranscript(transcript);
      // Persist to DB so it survives navigation/session changes
      const episodeId = useEpisodeStore.getState().currentEpisode?.id;
      if (episodeId) {
        updateEpisode(episodeId, { transcript }).catch(console.error);
      }
    }).then((unlisten) => {
      unlistenTranscriptRef.current = unlisten;
    });
    return () => {
      active = false;
      unlistenTranscriptRef.current?.();
    };
  }, [setCleanvoiceTranscript]);

  // ─── Helpers ──────────────────────────────────────────────────
  const buildEpisodeName = () => {
    const epNum = currentEpisode?.episode_number || "XX";
    const title = (currentEpisode?.title || "episode").replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40);
    return `MAM-EP${epNum}-${title}`;
  };

  const getSelectedCvConfig = () => {
    const preset = CV_PRESETS.find((p) => p.id === cvPreset);
    return preset?.config || CV_PRESETS[0].config;
  };

  // Does the selected CV preset have editing features (cuts)?
  const hasEditingFeatures = () => {
    const config = getSelectedCvConfig();
    return !!(config.fillers || config.long_silences || config.mouth_sounds ||
              config.stutters || config.hesitations || config.breath);
  };

  // ─── Main enhancement handler ─────────────────────────────────
  const handleEnhance = async () => {
    if (!currentEpisode?.original_video_path || !videoInfo) return;

    if (!enhancedVideoDirectory) {
      setError("Please set an Enhanced Video output directory in Settings → General first.");
      return;
    }

    if (enableCleanvoice && !aiEnhancementApiKey) {
      setError("Cleanvoice AI is enabled but no API key is set. Go to Settings → API Keys to add your Cleanvoice key, or disable AI Clean & Restore.");
      return;
    }

    // Capture session ID so we can detect if the wizard was reset mid-flight
    const sessionId = wizardSessionId;
    const isStale = () => useEpisodeStore.getState().wizardSessionId !== sessionId;

    setError(null);
    setProcessing(true);
    setProgress(0);
    setProgressDetail(null);

    const inputPath = currentEpisode.original_video_path;
    const episodeName = buildEpisodeName();
    const finalOutputPath = `${enhancedVideoDirectory}/${episodeName}-enhanced.mp4`;

    try {
      let audioForMastering = inputPath;

      // ── Stage 1: Cleanvoice AI ───────────────────────────────
      if (enableCleanvoice) {
        setCurrentStage("cleanvoice");
        setCleanvoiceMessage("Starting Cleanvoice AI...");

        const cvConfig = getSelectedCvConfig();

        // Cleanvoice always returns video when input is video
        // (enhance-only mode: extracts audio, enhances, muxes back into original video)
        const cvOutputPath = `${enhancedVideoDirectory}/${episodeName}-cv-enhanced.mp4`;

        const cleanResult = await cleanvoiceEnhance({
          api_key: aiEnhancementApiKey,
          input_path: inputPath,
          output_path: cvOutputPath,
          // Pass all config options
          remove_noise: cvConfig.remove_noise,
          studio_sound: cvConfig.studio_sound,
          normalize: cvConfig.normalize,
          fillers: cvConfig.fillers,
          long_silences: cvConfig.long_silences,
          mouth_sounds: cvConfig.mouth_sounds,
          breath: cvConfig.breath,
          stutters: cvConfig.stutters,
          hesitations: cvConfig.hesitations,
        });

        audioForMastering = cleanResult.output_path;
        setCleanvoiceMessage("AI enhancement complete!");

        // Save transcript directly from the command result (not relying on events)
        if (cleanResult.transcript) {
          setCleanvoiceTranscript(cleanResult.transcript);
          if (currentEpisode?.id) {
            updateEpisode(currentEpisode.id, { transcript: cleanResult.transcript }).catch(console.error);
          }
        }
      }

      // ── Stage 2: FFmpeg Broadcast Mastering ──────────────────
      let outputPath: string;
      if (enableMastering) {
        setCurrentStage("mastering");
        setProgress(0);
        setProgressDetail(null);

        outputPath = await enhanceAudio(
          audioForMastering,
          finalOutputPath,
          enhancementPreset,
          videoInfo.duration_seconds
        );
      } else {
        // No mastering — Cleanvoice output IS the final output
        // Cleanvoice always muxes enhanced audio back into video, so this is a video file
        outputPath = audioForMastering;
      }

      // Bail if the wizard was reset while we were processing
      if (isStale()) return;

      setEnhancedPath(outputPath);
      setCompleted(true);

      // Update episode in DB
      if (currentEpisode?.id) {
        try {
          await updateEpisode(currentEpisode.id, {
            enhanced_video_path: outputPath,
            status: "enhanced",
          });
          if (!isStale()) {
            setCurrentEpisode({
              ...currentEpisode,
              enhanced_video_path: outputPath,
              status: "enhanced",
            });
          }
        } catch (e) {
          console.error("Failed to update episode in DB:", e);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("cancelled")) {
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (!isStale()) {
        setProcessing(false);
        setProgress(0);
      }
      setCurrentStage("idle");
    }
  };

  const handleCancel = async () => {
    try {
      if (currentStage === "cleanvoice") {
        await cleanvoiceCancel();
      } else {
        await cancelProcessing();
      }
    } catch {
      // ignore
    }
  };

  const handleContinue = () => setCurrentStep("extract");
  const handleSkip = () => setCurrentStep("extract");

  const hasCleanvoiceKey = !!aiEnhancementApiKey;

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* ── Stage 1: AI Clean & Restore ──────────────────────── */}
      <div>
        <p style={sectionLabelStyle}>Step 1 — AI Clean & Restore</p>
        <button
          onClick={() => setEnableCleanvoice(!enableCleanvoice)}
          disabled={isProcessing}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "14px",
            padding: "18px 20px",
            width: "100%",
            backgroundColor: "var(--color-surface)",
            border: `1px solid ${enableCleanvoice ? "var(--color-sage)" : "var(--color-border)"}`,
            borderRadius: "12px",
            cursor: isProcessing ? "default" : "pointer",
            textAlign: "left",
            transition: "border-color 150ms ease",
            boxShadow: enableCleanvoice ? "0 0 0 1px var(--color-sage)" : "none",
            opacity: isProcessing ? 0.7 : 1,
          }}
        >
          <div style={{
            width: "20px", height: "20px", borderRadius: "4px", flexShrink: 0, marginTop: "1px",
            backgroundColor: enableCleanvoice ? "var(--color-sage)" : "transparent",
            border: `2px solid ${enableCleanvoice ? "var(--color-sage)" : "var(--color-text-muted)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 150ms ease",
          }}>
            {enableCleanvoice && <Check size={13} style={{ color: "#fff" }} />}
          </div>
          <div style={{
            width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0,
            backgroundColor: enableCleanvoice ? "rgba(122, 139, 111, 0.15)" : "var(--color-surface-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: enableCleanvoice ? "var(--color-sage)" : "var(--color-text-muted)",
            transition: "all 150ms ease",
          }}>
            <Sparkles size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: "600", color: "var(--color-cream)" }}>
                Cleanvoice AI
              </span>
              <Badge variant="info">Cloud API</Badge>
              {!hasCleanvoiceKey && <Badge variant="warning">No API Key</Badge>}
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-text-muted)", lineHeight: "1.5" }}>
              AI-powered studio sound, noise removal, and voice isolation. Can also remove filler words, stutters, and long silences.
            </p>
          </div>
        </button>

        {/* Cleanvoice preset selector */}
        {enableCleanvoice && (
          <div style={{ marginTop: "12px", paddingLeft: "34px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              {CV_PRESETS.map((preset) => {
                const isSelected = cvPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => !isProcessing && setCvPreset(preset.id)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px",
                      padding: "14px",
                      backgroundColor: "var(--color-surface)",
                      border: `1px solid ${isSelected ? "var(--color-sage)" : "var(--color-border)"}`,
                      borderRadius: "10px",
                      cursor: isProcessing ? "default" : "pointer",
                      textAlign: "left",
                      transition: "border-color 150ms ease",
                      boxShadow: isSelected ? "0 0 0 1px var(--color-sage)" : "none",
                      position: "relative",
                    }}
                  >
                    {isSelected && (
                      <div style={{ position: "absolute", top: "10px", right: "10px", color: "var(--color-sage)" }}>
                        <Check size={13} />
                      </div>
                    )}
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: "600", color: "var(--color-cream)", marginBottom: "3px" }}>
                      {preset.label}
                    </p>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-text-muted)", lineHeight: "1.4" }}>
                      {preset.detail}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Smart routing info */}
            <div style={{
              marginTop: "10px",
              padding: "8px 12px",
              backgroundColor: "rgba(122, 139, 111, 0.06)",
              borderRadius: "6px",
              fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-text-muted)",
            }}>
              {hasEditingFeatures()
                ? "📹 Video will be uploaded to Cleanvoice for timeline editing (fillers, silences, etc. will be cut)"
                : "🎵 Audio will be extracted and uploaded (faster — video stream not needed for enhancement-only)"
              }
            </div>
          </div>
        )}
      </div>

      {/* ── Stage 2: FFmpeg Broadcast Mastering ──────────────── */}
      <div>
        <p style={sectionLabelStyle}>Step 2 — Broadcast Mastering</p>
        <button
          onClick={() => setEnableMastering(!enableMastering)}
          disabled={isProcessing}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "14px",
            padding: "18px 20px",
            width: "100%",
            backgroundColor: "var(--color-surface)",
            border: `1px solid ${enableMastering ? "var(--color-sage)" : "var(--color-border)"}`,
            borderRadius: "12px",
            cursor: isProcessing ? "default" : "pointer",
            textAlign: "left",
            transition: "border-color 150ms ease",
            boxShadow: enableMastering ? "0 0 0 1px var(--color-sage)" : "none",
            opacity: isProcessing ? 0.7 : 1,
          }}
        >
          <div style={{
            width: "20px", height: "20px", borderRadius: "4px", flexShrink: 0, marginTop: "1px",
            backgroundColor: enableMastering ? "var(--color-sage)" : "transparent",
            border: `2px solid ${enableMastering ? "var(--color-sage)" : "var(--color-text-muted)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 150ms ease",
          }}>
            {enableMastering && <Check size={13} style={{ color: "#fff" }} />}
          </div>
          <div style={{
            width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0,
            backgroundColor: enableMastering ? "rgba(122, 139, 111, 0.15)" : "var(--color-surface-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: enableMastering ? "var(--color-sage)" : "var(--color-text-muted)",
            transition: "all 150ms ease",
          }}>
            <Cpu size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: "600", color: "var(--color-cream)" }}>
                FFmpeg Mastering
              </span>
              <Badge variant="success">Free · Local</Badge>
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-text-muted)", lineHeight: "1.5" }}>
              EQ, compression, limiting, and -16 LUFS normalization. Shapes your audio to broadcast podcast standards.
            </p>
          </div>
        </button>

        {/* Preset selector (only when mastering enabled) */}
        {enableMastering && (
          <div style={{ marginTop: "12px", paddingLeft: "34px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              {PRESETS.map((preset) => {
                const isSelected = enhancementPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => !isProcessing && setEnhancementPreset(preset.id)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px",
                      padding: "14px",
                      backgroundColor: "var(--color-surface)",
                      border: `1px solid ${isSelected ? "var(--color-sage)" : "var(--color-border)"}`,
                      borderRadius: "10px",
                      cursor: isProcessing ? "default" : "pointer",
                      textAlign: "left",
                      transition: "border-color 150ms ease",
                      boxShadow: isSelected ? "0 0 0 1px var(--color-sage)" : "none",
                      position: "relative",
                    }}
                  >
                    {isSelected && (
                      <div style={{ position: "absolute", top: "10px", right: "10px", color: "var(--color-sage)" }}>
                        <Check size={13} />
                      </div>
                    )}
                    <div style={{
                      color: isSelected ? "var(--color-sage)" : "var(--color-text-muted)",
                      transition: "color 150ms ease",
                    }}>
                      {preset.icon}
                    </div>
                    <div>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: "600", color: "var(--color-cream)", marginBottom: "3px" }}>
                        {preset.label}
                      </p>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-text-muted)", lineHeight: "1.4" }}>
                        {preset.detail}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pipeline summary */}
      {!isProcessing && !completed && (enableCleanvoice || enableMastering) && (
        <div style={{
          padding: "12px 16px",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
        }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: "600", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "8px" }}>
            Pipeline
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={pipelineStepStyle}>Original Video</span>
            {enableCleanvoice && (
              <>
                <span style={pipelineArrowStyle}>→</span>
                <span style={{ ...pipelineStepStyle, color: "var(--color-sage)" }}>
                  Cleanvoice AI ({CV_PRESETS.find(p => p.id === cvPreset)?.label})
                </span>
              </>
            )}
            {enableMastering && (
              <>
                <span style={pipelineArrowStyle}>→</span>
                <span style={{ ...pipelineStepStyle, color: "var(--color-sage)" }}>
                  FFmpeg Master ({enhancementPreset})
                </span>
              </>
            )}
            <span style={pipelineArrowStyle}>→</span>
            <span style={pipelineStepStyle}>Enhanced Video</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: "12px 16px",
          backgroundColor: "rgba(192, 57, 43, 0.12)",
          border: "1px solid rgba(192, 57, 43, 0.25)",
          borderRadius: "8px",
          fontFamily: "var(--font-body)", fontSize: "13px", color: "#E57373",
        }}>
          {error}
        </div>
      )}

      {/* Processing state */}
      {isProcessing && (
        <div style={{
          padding: "20px",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "12px",
          display: "flex", flexDirection: "column", gap: "16px",
        }}>
          {/* Stage indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Loader2 size={16} style={{ color: "var(--color-sage)", animation: "spin 1s linear infinite" }} />
            <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: "600", color: "var(--color-cream)" }}>
              {currentStage === "cleanvoice" && "Stage 1: Cleanvoice AI"}
              {currentStage === "mastering" && "Stage 2: Broadcast Mastering"}
              {currentStage === "muxing" && "Muxing audio into video..."}
            </span>
          </div>

          {/* Cleanvoice message */}
          {currentStage === "cleanvoice" && cleanvoiceMessage && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-text-muted)" }}>
              {cleanvoiceMessage}
            </p>
          )}

          <ProgressBar
            value={processingProgress}
            label={
              currentStage === "cleanvoice"
                ? cleanvoiceMessage
                : "Processing audio..."
            }
          />

          {/* FFmpeg detail stats */}
          {currentStage === "mastering" && progressDetail && (
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              {[
                { label: "Processed", value: progressDetail.time_processed },
                { label: "Speed", value: progressDetail.speed },
                ...(processingEta ? [{ label: "ETA", value: processingEta }] : []),
              ].map((item) => (
                <div key={item.label}>
                  <span style={{
                    fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: "600",
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    color: "var(--color-text-muted)", display: "block", marginBottom: "2px",
                  }}>{item.label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--color-cream)" }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      )}

      {/* Completed state */}
      {completed && !isProcessing && (
        <div style={{
          padding: "20px",
          backgroundColor: "rgba(122, 139, 111, 0.08)",
          border: "1px solid rgba(122, 139, 111, 0.25)",
          borderRadius: "12px",
          display: "flex", alignItems: "center", gap: "14px",
        }}>
          <CheckCircle2 size={24} style={{ color: "var(--color-sage)", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: "600", color: "var(--color-cream)", marginBottom: "2px" }}>
              Enhancement complete
            </p>
            {enhancedPath && (
              <p style={{
                fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-text-muted)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {enhancedPath}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Output directory notice */}
      {enhancedVideoDirectory && !isProcessing && !completed && (
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "10px 14px",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
        }}>
          <FolderOpen size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-text-muted)" }}>
            Output:{" "}
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-cream)" }}>
              {enhancedVideoDirectory}
            </span>
          </span>
        </div>
      )}

      {!enhancedVideoDirectory && !isProcessing && !completed && (
        <div style={{
          padding: "12px 16px",
          backgroundColor: "rgba(196, 116, 90, 0.1)",
          border: "1px solid rgba(196, 116, 90, 0.25)",
          borderRadius: "8px",
          fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--color-terracotta)",
        }}>
          No output directory set. Go to <span style={{ textDecoration: "underline" }}>Settings → General</span> to set the Enhanced Video output folder.
        </div>
      )}

      {/* No stages selected warning */}
      {!enableCleanvoice && !enableMastering && !isProcessing && !completed && (
        <div style={{
          padding: "12px 16px",
          backgroundColor: "rgba(196, 116, 90, 0.1)",
          border: "1px solid rgba(196, 116, 90, 0.25)",
          borderRadius: "8px",
          fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--color-terracotta)",
        }}>
          Select at least one enhancement stage, or skip to extraction.
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "4px" }}>
        <button
          onClick={handleSkip}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--font-body)", fontSize: "13px",
            color: "var(--color-text-muted)", textDecoration: "underline",
          }}
        >
          Skip enhancement
        </button>

        <div style={{ display: "flex", gap: "10px" }}>
          {!isProcessing && !completed && (
            <Button
              variant="primary"
              size="lg"
              icon={enableCleanvoice ? <Sparkles size={16} /> : <Cpu size={16} />}
              onClick={handleEnhance}
              disabled={
                !currentEpisode?.original_video_path ||
                (!enableCleanvoice && !enableMastering)
              }
            >
              {enableCleanvoice && enableMastering
                ? "Enhance Audio (AI + Master)"
                : enableCleanvoice
                  ? "Enhance Audio (AI)"
                  : "Master Audio"}
            </Button>
          )}
          {completed && (
            <Button variant="primary" size="lg" onClick={handleContinue}>
              Continue to Extraction
            </Button>
          )}
        </div>
      </div>

      {/* CSS for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── Shared styles ──────────────────────────────────────────────

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "11px",
  fontWeight: "600",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  marginBottom: "12px",
};

const pipelineStepStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  color: "var(--color-cream)",
};

const pipelineArrowStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  color: "var(--color-text-muted)",
};
