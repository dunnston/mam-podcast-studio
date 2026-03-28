import { useState, useRef, useCallback } from "react";
import {
  UploadCloud,
  Film,
  HardDrive,
  Clock,
  Monitor,
  Mic2,
  CheckCircle2,
} from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useEpisodeStore } from "../../stores/episodeStore";
import { openVideoFile, probeVideo } from "../../lib/tauri";
import { getNextEpisodeNumber, createEpisode } from "../../lib/database";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";

export function ImportStep() {
  const {
    videoInfo,
    currentEpisode,
    setVideoInfo,
    setCurrentEpisode,
    setCurrentStep,
  } = useEpisodeStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(
    currentEpisode?.original_video_path || null
  );

  // Form state
  const [episodeNumber, setEpisodeNumber] = useState(
    currentEpisode?.episode_number?.toString() || ""
  );
  const [title, setTitle] = useState(currentEpisode?.title || "");
  const [recordingDate, setRecordingDate] = useState(
    currentEpisode?.recording_date || new Date().toISOString().split("T")[0]
  );
  const [guestNames, setGuestNames] = useState(
    currentEpisode?.guest_names?.join(", ") || ""
  );
  const [tags, setTags] = useState(currentEpisode?.tags?.join(", ") || "");

  const dropZoneRef = useRef<HTMLDivElement>(null);

  const processFile = useCallback(
    async (path: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const info = await probeVideo(path);
        setVideoInfo(info);
        setFilePath(path);

        // Auto-populate episode number
        if (!episodeNumber) {
          const nextNum = await getNextEpisodeNumber();
          setEpisodeNumber(String(nextNum));
        }

        // Auto-populate title from filename
        if (!title) {
          const fileName = path.split(/[\\/]/).pop() || "";
          const baseName = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
          setTitle(baseName);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to read video file."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [episodeNumber, title, setVideoInfo]
  );

  const handleBrowse = async () => {
    const path = await openVideoFile();
    if (path) await processFile(path);
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      // In Tauri, we can't get the real path from a DataTransfer directly.
      // Trigger native dialog instead as fallback.
      await handleBrowse();
    },
    [handleBrowse]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleContinue = async () => {
    if (!videoInfo || !filePath) return;

    // Validate episode number
    const epNum = episodeNumber ? parseInt(episodeNumber, 10) : undefined;
    if (episodeNumber && (isNaN(epNum!) || epNum! < 1)) {
      setError("Episode number must be a positive integer.");
      return;
    }

    const episodeData = {
      title: title || "Untitled Episode",
      episode_number: epNum,
      recording_date: recordingDate || undefined,
      guest_names: guestNames
        ? guestNames.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
      tags: tags
        ? tags.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
      original_video_path: filePath,
      status: "draft" as const,
    };

    try {
      // Save to SQLite database
      const episodeId = await createEpisode(episodeData);
      setCurrentEpisode({ ...episodeData, id: episodeId });
      setCurrentStep("enhance");
    } catch (err) {
      console.error("Failed to save episode to database:", err);
      setError("Failed to save episode. Please check available disk space and try again.");
    }
  };

  const hasFile = Boolean(videoInfo && filePath);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Drop zone */}
      <div
        ref={dropZoneRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={!hasFile ? handleBrowse : undefined}
        style={{
          border: `2px dashed ${
            isDragging
              ? "var(--color-sage)"
              : hasFile
              ? "var(--color-sage-dark)"
              : "var(--color-border)"
          }`,
          borderRadius: "14px",
          padding: "48px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          cursor: hasFile ? "default" : "pointer",
          backgroundColor: isDragging
            ? "rgba(122, 139, 111, 0.06)"
            : hasFile
            ? "rgba(122, 139, 111, 0.04)"
            : "var(--color-surface)",
          transition: "border-color 150ms ease, background-color 150ms ease",
        }}
      >
        {isLoading ? (
          <>
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                backgroundColor: "rgba(196, 116, 90, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UploadCloud
                size={24}
                style={{
                  color: "var(--color-terracotta)",
                  animation: "bounce 1s ease-in-out infinite",
                }}
              />
            </div>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "15px",
                fontWeight: "500",
                color: "var(--color-cream)",
              }}
            >
              Reading video file...
            </p>
            <style>{`
              @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-6px); }
              }
            `}</style>
          </>
        ) : hasFile ? (
          <>
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                backgroundColor: "rgba(122, 139, 111, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckCircle2 size={24} style={{ color: "var(--color-sage)" }} />
            </div>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "15px",
                fontWeight: "500",
                color: "var(--color-cream)",
              }}
            >
              Video loaded successfully
            </p>
            <button
              onClick={handleBrowse}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                color: "var(--color-sage)",
                textDecoration: "underline",
              }}
            >
              Choose a different file
            </button>
          </>
        ) : (
          <>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                backgroundColor: isDragging
                  ? "rgba(122, 139, 111, 0.15)"
                  : "var(--color-surface-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color 150ms ease",
              }}
            >
              <UploadCloud
                size={28}
                style={{
                  color: isDragging
                    ? "var(--color-sage)"
                    : "var(--color-text-muted)",
                  transition: "color 150ms ease",
                }}
              />
            </div>
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "15px",
                  fontWeight: "500",
                  color: "var(--color-cream)",
                  marginBottom: "6px",
                }}
              >
                Drop your video file here
              </p>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "13px",
                  color: "var(--color-text-muted)",
                }}
              >
                or{" "}
                <span style={{ color: "var(--color-sage)", textDecoration: "underline" }}>
                  click to browse
                </span>{" "}
                — MP4, MOV, MKV, AVI
              </p>
            </div>
          </>
        )}
      </div>

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

      {/* Video info + preview */}
      {videoInfo && filePath && (
        <>
          <Card padding="none">
            {/* File info grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "0",
                padding: "0",
              }}
            >
              {[
                {
                  icon: <Film size={14} />,
                  label: "Filename",
                  value: filePath.split(/[\\/]/).pop() || filePath,
                },
                {
                  icon: <HardDrive size={14} />,
                  label: "File Size",
                  value: videoInfo.file_size_display,
                },
                {
                  icon: <Clock size={14} />,
                  label: "Duration",
                  value: videoInfo.duration_display,
                },
                {
                  icon: <Monitor size={14} />,
                  label: "Resolution",
                  value: videoInfo.resolution,
                },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: "16px 20px",
                    borderRight:
                      i < 3 ? "1px solid var(--color-border)" : undefined,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "6px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {item.icon}
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "11px",
                        fontWeight: "600",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "13px",
                      color: "var(--color-cream)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div
              style={{
                borderTop: "1px solid var(--color-border)",
                padding: "16px 20px",
                display: "flex",
                gap: "24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Film size={13} style={{ color: "var(--color-text-muted)" }} />
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "12px",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Video:{" "}
                  <span style={{ color: "var(--color-cream)" }}>
                    {videoInfo.video_codec}
                  </span>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Mic2 size={13} style={{ color: "var(--color-text-muted)" }} />
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "12px",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Audio:{" "}
                  <span style={{ color: "var(--color-cream)" }}>
                    {videoInfo.audio_codec}
                  </span>
                </span>
              </div>
              {videoInfo.bitrate && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "12px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Bitrate:{" "}
                    <span style={{ color: "var(--color-cream)" }}>
                      {Math.round(videoInfo.bitrate / 1000)} kbps
                    </span>
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Video preview */}
          <div>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                fontWeight: "600",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
                marginBottom: "10px",
              }}
            >
              Preview
            </p>
            <video
              src={filePath ? convertFileSrc(filePath, "media") : undefined}
              controls
              style={{
                width: "100%",
                maxHeight: "240px",
                borderRadius: "10px",
                border: "1px solid var(--color-border)",
                backgroundColor: "#000",
                display: "block",
              }}
            />
          </div>

          {/* Episode metadata form */}
          <div>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                fontWeight: "600",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
                marginBottom: "16px",
              }}
            >
              Episode Details
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr 1fr",
                gap: "16px",
                marginBottom: "16px",
              }}
            >
              <Input
                label="Episode Number"
                type="number"
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(e.target.value)}
                placeholder="e.g. 42"
              />
              <Input
                label="Episode Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Why Ancient Foods Matter"
              />
              <Input
                label="Recording Date"
                type="date"
                value={recordingDate}
                onChange={(e) => setRecordingDate(e.target.value)}
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              <Input
                label="Guest Names"
                value={guestNames}
                onChange={(e) => setGuestNames(e.target.value)}
                placeholder="Jane Smith, John Doe"
              />
              <Input
                label="Tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="nutrition, ancestral, fermentation"
              />
            </div>
          </div>

          {/* Continue button */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="primary"
              size="lg"
              onClick={handleContinue}
              disabled={!title.trim()}
            >
              Continue to Enhancement
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
