import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  Film,
  AudioWaveform,
  FileAudio,
  FileText,
  FolderOpen,
  PlusCircle,
  Library,
  ArrowRight,
} from "lucide-react";
import { useEpisodeStore } from "../../stores/episodeStore";
import { useNewEpisode } from "../../hooks/useNewEpisode";

interface SummaryCardProps {
  title: string;
  icon: React.ReactNode;
  completed: boolean;
  children: React.ReactNode;
}

function SummaryCard({ title, icon, completed, children }: SummaryCardProps) {
  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: `1px solid ${completed ? "rgba(122, 139, 111, 0.3)" : "var(--color-border)"}`,
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "16px 20px",
          borderBottom: completed ? "1px solid rgba(122, 139, 111, 0.15)" : "1px solid var(--color-border)",
          backgroundColor: completed
            ? "rgba(122, 139, 111, 0.05)"
            : "transparent",
        }}
      >
        <span
          style={{
            color: completed ? "var(--color-sage)" : "var(--color-text-muted)",
          }}
        >
          {icon}
        </span>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "14px",
            fontWeight: "600",
            color: "var(--color-cream)",
            flex: 1,
          }}
        >
          {title}
        </span>
        {completed ? (
          <CheckCircle2 size={16} style={{ color: "var(--color-sage)", flexShrink: 0 }} />
        ) : (
          <Circle size={16} style={{ color: "var(--color-border)", flexShrink: 0 }} />
        )}
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        marginBottom: "8px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "12px",
          color: "var(--color-text-muted)",
          minWidth: "120px",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "12px",
          color: "var(--color-cream)",
          wordBreak: "break-all",
        }}
      >
        {String(value)}
      </span>
    </div>
  );
}

export function ReviewStep() {
  const navigate = useNavigate();
  const {
    currentEpisode,
    videoInfo,
    enhancementPreset,
    selectedFormats,
    showNotesContent,
    showNotesEdited,
  } = useEpisodeStore();
  const handleStartNew = useNewEpisode();

  const hasImport = Boolean(currentEpisode?.original_video_path && videoInfo);
  const hasEnhancement = Boolean(currentEpisode?.enhanced_video_path);
  const hasExtraction = selectedFormats.length > 0;
  const hasShowNotes = Boolean(showNotesContent || showNotesEdited);

  const notesContent = showNotesEdited || showNotesContent;
  const wordCount = notesContent
    ? notesContent.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div
        style={{
          padding: "24px",
          backgroundColor: "rgba(122, 139, 111, 0.08)",
          border: "1px solid rgba(122, 139, 111, 0.2)",
          borderRadius: "12px",
          textAlign: "center",
        }}
      >
        <CheckCircle2
          size={40}
          style={{ color: "var(--color-sage)", margin: "0 auto 12px" }}
        />
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "28px",
            fontWeight: "600",
            color: "var(--color-cream)",
            marginBottom: "6px",
          }}
        >
          Episode Ready
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "14px",
            color: "var(--color-text-muted)",
          }}
        >
          {currentEpisode?.title || "Untitled Episode"}
          {currentEpisode?.episode_number
            ? ` — Episode ${currentEpisode.episode_number}`
            : ""}
        </p>
      </div>

      {/* Summary cards */}
      <SummaryCard
        title="Import"
        icon={<Film size={16} />}
        completed={hasImport}
      >
        {hasImport ? (
          <>
            <DataRow
              label="File"
              value={currentEpisode?.original_video_path?.split(/[\\/]/).pop()}
            />
            <DataRow
              label="Episode #"
              value={currentEpisode?.episode_number}
            />
            <DataRow label="Title" value={currentEpisode?.title} />
            <DataRow
              label="Duration"
              value={videoInfo?.duration_display}
            />
            <DataRow
              label="File Size"
              value={videoInfo?.file_size_display}
            />
          </>
        ) : (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              color: "var(--color-text-muted)",
            }}
          >
            No video imported
          </p>
        )}
      </SummaryCard>

      <SummaryCard
        title="Audio Enhancement"
        icon={<AudioWaveform size={16} />}
        completed={hasEnhancement}
      >
        {hasEnhancement ? (
          <>
            <DataRow label="Method" value="FFmpeg (Built-in)" />
            <DataRow label="Preset" value={enhancementPreset} />
            <DataRow
              label="Output"
              value={currentEpisode?.enhanced_video_path?.split(/[\\/]/).pop()}
            />
          </>
        ) : (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              color: "var(--color-text-muted)",
            }}
          >
            Enhancement skipped — original audio will be used for extraction
          </p>
        )}
      </SummaryCard>

      <SummaryCard
        title="Audio Extraction"
        icon={<FileAudio size={16} />}
        completed={hasExtraction}
      >
        {hasExtraction ? (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {selectedFormats.map((fmt) => (
              <span
                key={fmt}
                style={{
                  padding: "3px 10px",
                  backgroundColor: "rgba(122, 139, 111, 0.15)",
                  border: "1px solid rgba(122, 139, 111, 0.25)",
                  borderRadius: "6px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  color: "var(--color-sage-light)",
                  textTransform: "uppercase",
                }}
              >
                {fmt}
              </span>
            ))}
          </div>
        ) : (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              color: "var(--color-text-muted)",
            }}
          >
            No formats extracted
          </p>
        )}
      </SummaryCard>

      <SummaryCard
        title="Show Notes"
        icon={<FileText size={16} />}
        completed={hasShowNotes}
      >
        {hasShowNotes ? (
          <>
            <DataRow label="Word count" value={`${wordCount.toLocaleString()} words`} />
            <div
              style={{
                marginTop: "10px",
                padding: "12px",
                backgroundColor: "var(--color-charcoal)",
                borderRadius: "8px",
                maxHeight: "80px",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: "var(--color-text-muted)",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                  overflow: "hidden",
                }}
              >
                {notesContent.slice(0, 200)}...
              </p>
            </div>
          </>
        ) : (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              color: "var(--color-text-muted)",
            }}
          >
            Show notes not generated
          </p>
        )}
      </SummaryCard>

      {/* File locations */}
      {(currentEpisode?.original_video_path ||
        currentEpisode?.enhanced_video_path) && (
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
            File Locations
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {[
              {
                label: "Original",
                path: currentEpisode?.original_video_path,
              },
              {
                label: "Enhanced",
                path: currentEpisode?.enhanced_video_path,
              },
            ]
              .filter((f) => f.path)
              .map((file) => (
                <div
                  key={file.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                  }}
                >
                  <FolderOpen
                    size={14}
                    style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "11px",
                      fontWeight: "600",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "var(--color-text-muted)",
                      minWidth: "64px",
                    }}
                  >
                    {file.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      color: "var(--color-cream)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {file.path}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "8px",
          borderTop: "1px solid var(--color-border)",
          marginTop: "8px",
        }}
      >
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
            transition: "color 150ms ease",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color =
              "var(--color-sage-light)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color =
              "var(--color-sage)")
          }
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
            transition: "background-color 150ms ease",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "var(--color-terracotta-dark)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "var(--color-terracotta)")
          }
        >
          <PlusCircle size={15} />
          Start New Episode
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
