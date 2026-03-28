import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  PlusCircle,
  Library,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useEpisodeStore } from "../../stores/episodeStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { Button } from "../../components/ui/Button";
import {
  podbeanPublish,
  youtubeUpload,
  onPodbeanProgress,
  onYouTubeProgress,
  openImageFile,
} from "../../lib/tauri";
import type { PodbeanProgress, YouTubeProgress } from "../../lib/tauri";
import { getAudioExports } from "../../lib/database";

type PublishStatus = "idle" | "publishing" | "done" | "error";

interface TargetState {
  enabled: boolean;
  status: PublishStatus;
  progress: number;
  message: string;
  error: string;
  resultUrl?: string;
}

export function PublishStep() {
  const navigate = useNavigate();
  const {
    currentEpisode,
    showNotesContent,
    showNotesEdited,
    resetWizard,
  } = useEpisodeStore();
  const settings = useSettingsStore();

  const showNotes = showNotesEdited || showNotesContent;

  // Podbean config
  const hasPodbean = Boolean(settings.podbeanClientId && settings.podbeanClientSecret);
  const [podbean, setPodbean] = useState<TargetState>({
    enabled: hasPodbean,
    status: "idle",
    progress: 0,
    message: "",
    error: "",
  });

  // YouTube config
  const hasYoutube = Boolean(
    settings.youtubeClientId &&
    settings.youtubeClientSecret &&
    settings.youtubeRefreshToken
  );
  const [youtube, setYoutube] = useState<TargetState>({
    enabled: hasYoutube,
    status: "idle",
    progress: 0,
    message: "",
    error: "",
  });

  const [thumbnailPath, setThumbnailPath] = useState<string>("");
  const [youtubePrivacy, setYoutubePrivacy] = useState<string>("private");
  const [audioPath, setAudioPath] = useState<string>("");

  // Load the actual extracted audio path from the database
  useEffect(() => {
    if (!currentEpisode?.id) return;
    getAudioExports(currentEpisode.id).then((exports) => {
      if (exports.length === 0) return;
      // Prefer mp3, then m4a, then whatever is available
      const preferred =
        exports.find((e) => e.format === "mp3") ||
        exports.find((e) => e.format === "m4a") ||
        exports[0];
      if (preferred) setAudioPath(preferred.file_path);
    });
  }, [currentEpisode?.id]);

  // Video path for YouTube
  const videoPath =
    currentEpisode?.enhanced_video_path || currentEpisode?.original_video_path || "";

  // Listen for progress events
  useEffect(() => {
    const unlistenPodbean = onPodbeanProgress((p: PodbeanProgress) => {
      setPodbean((prev) => ({
        ...prev,
        progress: p.percent,
        message: p.message,
      }));
    });

    const unlistenYoutube = onYouTubeProgress((p: YouTubeProgress) => {
      setYoutube((prev) => ({
        ...prev,
        progress: p.percent,
        message: p.message,
      }));
    });

    return () => {
      unlistenPodbean.then((fn) => fn());
      unlistenYoutube.then((fn) => fn());
    };
  }, []);

  const isPublishing = podbean.status === "publishing" || youtube.status === "publishing";
  const allDone =
    (!podbean.enabled || podbean.status === "done" || podbean.status === "error") &&
    (!youtube.enabled || youtube.status === "done" || youtube.status === "error");
  const anyEnabled = podbean.enabled || youtube.enabled;

  const handlePublish = async () => {
    const publishToPodbean = async () => {
      setPodbean((prev) => ({ ...prev, status: "publishing", progress: 0, message: "Starting...", error: "" }));
      try {
        const result = await podbeanPublish({
          client_id: settings.podbeanClientId,
          client_secret: settings.podbeanClientSecret,
          audio_path: audioPath,
          title: currentEpisode?.title || "Untitled Episode",
          content: showNotes,
          status: "draft",
        });
        setPodbean((prev) => ({
          ...prev,
          status: "done",
          progress: 100,
          message: "Published to Podbean!",
          resultUrl: result.permalink_url || undefined,
        }));
      } catch (err) {
        setPodbean((prev) => ({
          ...prev,
          status: "error",
          error: String(err),
          message: "Failed",
        }));
      }
    };

    const publishToYoutube = async () => {
      setYoutube((prev) => ({ ...prev, status: "publishing", progress: 0, message: "Starting...", error: "" }));
      try {
        const result = await youtubeUpload({
          client_id: settings.youtubeClientId,
          client_secret: settings.youtubeClientSecret,
          refresh_token: settings.youtubeRefreshToken,
          video_path: videoPath,
          title: currentEpisode?.title || "Untitled Episode",
          description: showNotes,
          tags: currentEpisode?.tags || [],
          privacy_status: youtubePrivacy,
          thumbnail_path: thumbnailPath || undefined,
        });
        const videoUrl = result.video_id
          ? `https://youtube.com/watch?v=${result.video_id}`
          : undefined;
        setYoutube((prev) => ({
          ...prev,
          status: "done",
          progress: 100,
          message: `Uploaded to YouTube!${result.video_id ? ` (${result.video_id})` : ""}`,
          resultUrl: videoUrl,
        }));
      } catch (err) {
        setYoutube((prev) => ({
          ...prev,
          status: "error",
          error: String(err),
          message: "Failed",
        }));
      }
    };

    // Run both publishes concurrently
    const promises: Promise<void>[] = [];
    if (podbean.enabled) promises.push(publishToPodbean());
    if (youtube.enabled) promises.push(publishToYoutube());
    await Promise.allSettled(promises);
  };

  const handleStartNew = () => {
    resetWizard();
    navigate("/new-episode");
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "14px",
    fontWeight: "500",
    color: "var(--color-cream)",
    marginBottom: "4px",
  };

  const descStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "12px",
    color: "var(--color-text-muted)",
    lineHeight: "1.5",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Podbean card */}
      <PublishCard
        title="Podbean"
        subtitle="Upload audio + show notes as a new episode"
        enabled={podbean.enabled}
        onToggle={(v) => setPodbean((prev) => ({ ...prev, enabled: v }))}
        configured={hasPodbean}
        notConfiguredMsg="Set up Podbean credentials in Settings > API Keys"
        state={podbean}
      >
        {podbean.enabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={descStyle}>
              <strong style={{ color: "var(--color-cream)" }}>Audio file:</strong>{" "}
              {audioPath ? audioPath.split(/[\\/]/).pop() : "No audio extracted"}
            </div>
            <div style={descStyle}>
              <strong style={{ color: "var(--color-cream)" }}>Status:</strong> Draft (review on Podbean before going live)
            </div>
          </div>
        )}
      </PublishCard>

      {/* YouTube card */}
      <PublishCard
        title="YouTube"
        subtitle="Upload video + show notes as description"
        enabled={youtube.enabled}
        onToggle={(v) => setYoutube((prev) => ({ ...prev, enabled: v }))}
        configured={hasYoutube}
        notConfiguredMsg="Set up YouTube credentials and authorize in Settings > API Keys"
        state={youtube}
      >
        {youtube.enabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={descStyle}>
              <strong style={{ color: "var(--color-cream)" }}>Video file:</strong>{" "}
              {videoPath ? videoPath.split(/[\\/]/).pop() : "No video available"}
            </div>

            {/* Privacy setting */}
            <div>
              <p style={{ ...labelStyle, fontSize: "12px" }}>Visibility</p>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["private", "unlisted", "public"] as const).map((vis) => (
                  <button
                    key={vis}
                    onClick={() => setYoutubePrivacy(vis)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "6px",
                      border: `1px solid ${youtubePrivacy === vis ? "var(--color-sage)" : "var(--color-border)"}`,
                      backgroundColor: youtubePrivacy === vis ? "rgba(122, 139, 111, 0.15)" : "transparent",
                      color: youtubePrivacy === vis ? "var(--color-sage)" : "var(--color-text-muted)",
                      fontFamily: "var(--font-body)",
                      fontSize: "12px",
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {vis}
                  </button>
                ))}
              </div>
            </div>

            {/* Thumbnail */}
            <div>
              <p style={{ ...labelStyle, fontSize: "12px" }}>Cover Image (optional)</p>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const path = await openImageFile();
                    if (path) setThumbnailPath(path);
                  }}
                >
                  {thumbnailPath ? "Change Image" : "Select Image"}
                </Button>
                {thumbnailPath && (
                  <span style={{ ...descStyle, color: "var(--color-cream)" }}>
                    {thumbnailPath.split(/[\\/]/).pop()}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </PublishCard>

      {/* Publish button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "8px",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        {allDone && (podbean.status === "done" || youtube.status === "done") ? (
          <>
            <button
              onClick={() => navigate("/library")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                color: "var(--color-sage)",
              }}
            >
              <Library size={15} />
              Go to Library
            </button>
            <button
              onClick={handleStartNew}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                backgroundColor: "var(--color-terracotta)",
                color: "var(--color-cream)",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                fontWeight: "500",
              }}
            >
              <PlusCircle size={15} />
              Start New Episode
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                resetWizard();
                navigate("/library");
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                color: "var(--color-text-muted)",
              }}
            >
              Skip publishing
            </button>
            <button
              onClick={handlePublish}
              disabled={!anyEnabled || isPublishing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 24px",
                backgroundColor: !anyEnabled || isPublishing
                  ? "var(--color-border)"
                  : "var(--color-terracotta)",
                color: "var(--color-cream)",
                border: "none",
                borderRadius: "8px",
                cursor: !anyEnabled || isPublishing ? "not-allowed" : "pointer",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                fontWeight: "500",
                opacity: !anyEnabled ? 0.5 : 1,
              }}
            >
              {isPublishing ? (
                <>
                  <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                  Publishing...
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Publish
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Publish target card ─────────────────────────────────────────

interface PublishCardProps {
  title: string;
  subtitle: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  configured: boolean;
  notConfiguredMsg: string;
  state: TargetState;
  children: React.ReactNode;
}

function PublishCard({
  title,
  subtitle,
  enabled,
  onToggle,
  configured,
  notConfiguredMsg,
  state,
  children,
}: PublishCardProps) {
  const isActive = state.status === "publishing";
  const isDone = state.status === "done";
  const isError = state.status === "error";

  const borderColor = isDone
    ? "rgba(122, 139, 111, 0.4)"
    : isError
    ? "rgba(229, 115, 115, 0.4)"
    : isActive
    ? "rgba(196, 116, 90, 0.4)"
    : enabled
    ? "var(--color-border)"
    : "var(--color-border)";

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: `1px solid ${borderColor}`,
        borderRadius: "12px",
        overflow: "hidden",
        opacity: configured ? 1 : 0.6,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "16px 20px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {/* Toggle */}
        <button
          role="switch"
          aria-checked={enabled}
          disabled={!configured}
          onClick={() => configured && onToggle(!enabled)}
          style={{
            width: "40px",
            height: "22px",
            borderRadius: "11px",
            border: "none",
            cursor: configured ? "pointer" : "not-allowed",
            backgroundColor: enabled ? "var(--color-sage)" : "var(--color-border)",
            position: "relative",
            flexShrink: 0,
            padding: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "2px",
              left: enabled ? "20px" : "2px",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              backgroundColor: "var(--color-cream)",
              transition: "left 200ms cubic-bezier(0.34, 1.6, 0.64, 1)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}
          />
        </button>

        <div style={{ flex: 1 }}>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              fontWeight: "600",
              color: "var(--color-cream)",
            }}
          >
            {title}
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              color: "var(--color-text-muted)",
            }}
          >
            {configured ? subtitle : notConfiguredMsg}
          </p>
        </div>

        {/* Status icon */}
        {isDone && <CheckCircle2 size={18} style={{ color: "var(--color-sage)" }} />}
        {isError && <XCircle size={18} style={{ color: "#E57373" }} />}
        {isActive && (
          <Loader2
            size={18}
            style={{ color: "var(--color-terracotta)", animation: "spin 1s linear infinite" }}
          />
        )}
      </div>

      {/* Content */}
      {enabled && configured && (
        <div style={{ padding: "16px 20px" }}>
          {children}

          {/* Progress bar */}
          {(isActive || isDone) && (
            <div style={{ marginTop: "16px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "12px",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {state.message}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {Math.round(state.progress)}%
                </span>
              </div>
              <div
                style={{
                  height: "4px",
                  backgroundColor: "var(--color-border)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${state.progress}%`,
                    backgroundColor: isDone ? "var(--color-sage)" : "var(--color-terracotta)",
                    borderRadius: "2px",
                    transition: "width 300ms ease",
                  }}
                />
              </div>
            </div>
          )}

          {/* Result link */}
          {isDone && state.resultUrl && (
            <a
              href={state.resultUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                marginTop: "12px",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                color: "var(--color-sage)",
                textDecoration: "underline",
              }}
            >
              <ExternalLink size={13} />
              View on {title}
            </a>
          )}

          {/* Error message */}
          {isError && (
            <p
              style={{
                marginTop: "10px",
                fontFamily: "var(--font-body)",
                fontSize: "12px",
                color: "#E57373",
                lineHeight: "1.5",
              }}
            >
              {state.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
