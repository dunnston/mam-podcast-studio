import { useState, useEffect, useRef } from "react";
import {
  FolderOpen,
  FileAudio,
  CheckCircle2,
  Loader2,
  HardDrive,
} from "lucide-react";
import { useEpisodeStore } from "../../stores/episodeStore";
import {
  extractAudio,
  onExtractionProgress,
  selectOutputDirectory,
} from "../../lib/tauri";
import { updateEpisode, createAudioExport } from "../../lib/database";
import type { ExtractionResult } from "../../lib/tauri";
import { useSettingsStore } from "../../stores/settingsStore";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

interface FormatOption {
  id: string;
  label: string;
  detail: string;
  defaultChecked: boolean;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: "mp3",
    label: "MP3",
    detail: "320 kbps · Universal compatibility",
    defaultChecked: true,
  },
  {
    id: "m4a",
    label: "M4A / AAC",
    detail: "192 kbps · High quality, small size",
    defaultChecked: true,
  },
  {
    id: "wav",
    label: "WAV",
    detail: "Uncompressed · Lossless master",
    defaultChecked: false,
  },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExtractStep() {
  const {
    currentEpisode,
    videoInfo,
    selectedFormats,
    setSelectedFormats,
    setCurrentStep,
  } = useEpisodeStore();

  const { extractedAudioDirectory, setExtractedAudioDirectory } = useSettingsStore();
  const [isExtracting, setIsExtracting] = useState(false);
  const [formatStatuses, setFormatStatuses] = useState<
    Record<string, "pending" | "processing" | "done" | "error">
  >({});
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let active = true;
    onExtractionProgress((data) => {
      if (!active) return;
      setFormatStatuses((prev) => ({
        ...prev,
        [data.format]: data.status === "done" ? "done" : "processing",
      }));
    }).then((unlisten) => {
      unlistenRef.current = unlisten;
    });
    return () => {
      active = false;
      unlistenRef.current?.();
    };
  }, []);

  const toggleFormat = (id: string) => {
    setSelectedFormats(
      selectedFormats.includes(id)
        ? selectedFormats.filter((f) => f !== id)
        : [...selectedFormats, id]
    );
  };

  const handleSelectDirectory = async () => {
    const dir = await selectOutputDirectory();
    if (dir) {
      setExtractedAudioDirectory(dir);
      // Also persist to database
      const { setSetting } = await import("../../lib/database");
      await setSetting("extractedAudioDirectory", dir);
    }
  };

  const handleExtract = async () => {
    if (!currentEpisode?.original_video_path || !videoInfo) return;

    const inputPath =
      currentEpisode.enhanced_video_path || currentEpisode.original_video_path;
    if (!extractedAudioDirectory) {
      setError("Please select an output directory first.");
      return;
    }
    const dir = extractedAudioDirectory;

    // Reset state
    setError(null);
    setIsExtracting(true);
    setCompleted(false);
    const initialStatuses: Record<string, "pending" | "processing" | "done" | "error"> = {};
    selectedFormats.forEach((f) => (initialStatuses[f] = "pending"));
    setFormatStatuses(initialStatuses);

    try {
      const epName = `MAM-EP${currentEpisode.episode_number || "XX"}-${(currentEpisode.title || "episode")
        .replace(/[^a-zA-Z0-9]/g, "-")
        .slice(0, 40)}`;

      const extracted = await extractAudio({
        input_path: inputPath,
        output_dir: dir,
        episode_name: epName,
        formats: selectedFormats,
        total_duration: videoInfo.duration_seconds,
        title: currentEpisode.title,
        episode_number: currentEpisode.episode_number,
        show_name: "Modern Ancestral Mamas",
      });

      setResults(extracted);
      setCompleted(true);

      // Save audio exports to DB
      if (currentEpisode?.id) {
        try {
          for (const exp of extracted) {
            await createAudioExport({
              episode_id: currentEpisode.id,
              format: exp.format,
              file_path: exp.file_path,
              bitrate: exp.format === "mp3" ? 320 : exp.format === "m4a" ? 192 : undefined,
              file_size_bytes: exp.file_size_bytes,
            });
          }
          await updateEpisode(currentEpisode.id, { status: "extracted" });
        } catch (e) {
          console.error("Failed to save exports to DB:", e);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : typeof err === "string" ? err : "Extraction failed.");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Output directory */}
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
          Output Directory
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 14px",
            backgroundColor: "var(--color-surface)",
            border: `1px solid ${extractedAudioDirectory ? "var(--color-border)" : "rgba(196, 116, 90, 0.4)"}`,
            borderRadius: "10px",
          }}
        >
          <FolderOpen
            size={16}
            style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              color: extractedAudioDirectory ? "var(--color-cream)" : "var(--color-terracotta)",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {extractedAudioDirectory || "No directory selected — click Browse"}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSelectDirectory}
          >
            Browse
          </Button>
        </div>
      </div>

      {/* Format selection */}
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
          Export Formats
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {FORMAT_OPTIONS.map((fmt) => {
            const isSelected = selectedFormats.includes(fmt.id);
            const status = formatStatuses[fmt.id];

            return (
              <button
                key={fmt.id}
                onClick={() => !isExtracting && toggleFormat(fmt.id)}
                disabled={isExtracting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "14px 16px",
                  backgroundColor: "var(--color-surface)",
                  border: `1px solid ${isSelected ? "var(--color-sage)" : "var(--color-border)"}`,
                  borderRadius: "10px",
                  cursor: isExtracting ? "default" : "pointer",
                  textAlign: "left",
                  transition: "border-color 150ms ease, background-color 150ms ease",
                  boxShadow: isSelected ? "0 0 0 1px var(--color-sage)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected && !isExtracting) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      "var(--color-surface-light)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      "var(--color-surface)";
                  }
                }}
              >
                {/* Checkbox */}
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "5px",
                    border: `2px solid ${isSelected ? "var(--color-sage)" : "var(--color-border)"}`,
                    backgroundColor: isSelected ? "var(--color-sage)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "background-color 150ms ease, border-color 150ms ease",
                  }}
                >
                  {isSelected && (
                    <svg
                      width="10"
                      height="8"
                      viewBox="0 0 10 8"
                      fill="none"
                      style={{ display: "block" }}
                    >
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="var(--color-cream)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>

                <FileAudio
                  size={16}
                  style={{
                    color: isSelected
                      ? "var(--color-sage)"
                      : "var(--color-text-muted)",
                    flexShrink: 0,
                    transition: "color 150ms ease",
                  }}
                />

                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "var(--color-cream)",
                      marginRight: "8px",
                    }}
                  >
                    {fmt.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "12px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {fmt.detail}
                  </span>
                </div>

                {/* Status indicator */}
                {status === "processing" && (
                  <Loader2
                    size={16}
                    style={{
                      color: "var(--color-sage)",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                )}
                {status === "done" && (
                  <CheckCircle2 size={16} style={{ color: "var(--color-sage)" }} />
                )}
                <style>{`
                  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
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

      {/* Results */}
      {completed && results.length > 0 && (
        <Card padding="none">
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CheckCircle2 size={16} style={{ color: "var(--color-sage)" }} />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                fontWeight: "500",
                color: "var(--color-cream)",
              }}
            >
              Exported {results.length} file{results.length !== 1 ? "s" : ""}
            </span>
          </div>
          {results.map((result, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 20px",
                borderBottom:
                  i < results.length - 1
                    ? "1px solid var(--color-border)"
                    : undefined,
              }}
            >
              <FileAudio
                size={15}
                style={{ color: "var(--color-sage)", flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: "var(--color-cream)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {result.file_path.split(/[\\/]/).pop()}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: "var(--color-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {result.file_path}
                </p>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  flexShrink: 0,
                }}
              >
                <HardDrive
                  size={12}
                  style={{ color: "var(--color-text-muted)" }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {formatBytes(result.file_size_bytes)}
                </span>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={() => setCurrentStep("show-notes")}
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
          Skip extraction
        </button>

        <div style={{ display: "flex", gap: "10px" }}>
          {!completed && (
            <Button
              variant="primary"
              size="lg"
              onClick={handleExtract}
              loading={isExtracting}
              disabled={selectedFormats.length === 0 || !currentEpisode?.original_video_path}
            >
              {isExtracting ? "Extracting..." : "Extract Audio"}
            </Button>
          )}
          {completed && (
            <Button
              variant="primary"
              size="lg"
              onClick={() => setCurrentStep("show-notes")}
            >
              Continue to Show Notes
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
