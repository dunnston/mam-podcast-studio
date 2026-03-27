import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Trash2,
  Film,
  FileAudio,
  Clock,
  CalendarDays,
  Hash,
  Mic,
  PlusCircle,
  PlayCircle,
} from "lucide-react";
import {
  listEpisodes,
  deleteEpisode,
  getAudioExports,
  getShowNotes,
} from "../lib/database";
import { useEpisodeStore } from "../stores/episodeStore";
import type { Episode } from "../stores/episodeStore";
import { useNewEpisode } from "../hooks/useNewEpisode";
import type { EpisodeRow } from "../lib/database";
import { Badge } from "../components/ui/Badge";
import type { BadgeVariant } from "../components/ui/Badge";
import { ConfirmModal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "published":
      return "success";
    case "enhanced":
    case "extracted":
      return "info";
    case "processing":
      return "warning";
    case "draft":
    default:
      return "default";
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface EpisodeCardProps {
  episode: EpisodeRow;
  onDelete: (id: number) => void;
  onContinue: (episode: EpisodeRow) => void;
}

function EpisodeCard({ episode, onDelete, onContinue }: EpisodeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: exports = [] } = useQuery({
    queryKey: ["audio-exports", episode.id],
    queryFn: () => getAudioExports(episode.id),
    enabled: expanded,
  });

  const guests = episode.guest_names
    ? (JSON.parse(episode.guest_names) as string[])
    : [];
  const tags = episode.tags
    ? (JSON.parse(episode.tags) as string[])
    : [];

  return (
    <>
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "12px",
          overflow: "hidden",
          transition: "border-color 150ms ease",
        }}
        onMouseEnter={(e) => {
          if (!expanded)
            (e.currentTarget as HTMLDivElement).style.borderColor =
              "var(--color-text-muted)";
        }}
        onMouseLeave={(e) => {
          if (!expanded)
            (e.currentTarget as HTMLDivElement).style.borderColor =
              "var(--color-border)";
        }}
      >
        {/* Header row */}
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            width: "100%",
            padding: "16px 20px",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            transition: "background-color 150ms ease",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "rgba(255,255,255,0.02)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "transparent")
          }
        >
          {/* Episode number */}
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              backgroundColor: "rgba(122, 139, 111, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                fontWeight: "500",
                color: "var(--color-sage)",
              }}
            >
              {episode.episode_number ?? "—"}
            </span>
          </div>

          {/* Title + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "15px",
                fontWeight: "500",
                color: "var(--color-cream)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: "4px",
              }}
            >
              {episode.title}
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              {episode.recording_date && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <CalendarDays
                    size={11}
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "12px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Recorded {formatDate(episode.recording_date)}
                  </span>
                </div>
              )}
              <div
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <Clock
                  size={11}
                  style={{ color: "var(--color-text-muted)" }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "12px",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Added {formatDate(episode.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Badge + expand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexShrink: 0,
            }}
          >
            <Badge variant={statusVariant(episode.status)}>
              {episode.status}
            </Badge>
            {expanded ? (
              <ChevronDown size={16} style={{ color: "var(--color-text-muted)" }} />
            ) : (
              <ChevronRight size={16} style={{ color: "var(--color-border)" }} />
            )}
          </div>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div
            style={{
              borderTop: "1px solid var(--color-border)",
              padding: "20px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginBottom: "16px",
              }}
            >
              {/* File paths */}
              {episode.original_video_path && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "6px",
                    }}
                  >
                    <Film
                      size={13}
                      style={{ color: "var(--color-text-muted)" }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "11px",
                        fontWeight: "600",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      Original Video
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      color: "var(--color-cream)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {episode.original_video_path}
                  </p>
                </div>
              )}

              {guests.length > 0 && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "6px",
                    }}
                  >
                    <Mic
                      size={13}
                      style={{ color: "var(--color-text-muted)" }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "11px",
                        fontWeight: "600",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      Guests
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "13px",
                      color: "var(--color-cream)",
                    }}
                  >
                    {guests.join(", ")}
                  </p>
                </div>
              )}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "8px",
                  }}
                >
                  <Hash
                    size={12}
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "11px",
                      fontWeight: "600",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Tags
                  </span>
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: "2px 8px",
                        backgroundColor: "var(--color-surface-light)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "5px",
                        fontFamily: "var(--font-body)",
                        fontSize: "12px",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Audio exports */}
            {exports.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "8px",
                  }}
                >
                  <FileAudio
                    size={13}
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "11px",
                      fontWeight: "600",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Audio Exports
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  {exports.map((exp) => (
                    <div
                      key={exp.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 12px",
                        backgroundColor: "var(--color-charcoal)",
                        borderRadius: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          fontWeight: "600",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--color-sage)",
                          minWidth: "32px",
                        }}
                      >
                        {exp.format}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          color: "var(--color-cream)",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {exp.file_path.split(/[\\/]/).pop()}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          color: "var(--color-text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        {formatBytes(exp.file_size_bytes)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "8px",
                borderTop: "1px solid var(--color-border)",
              }}
            >
              <Button
                variant="primary"
                size="sm"
                icon={<PlayCircle size={13} />}
                onClick={() => onContinue(episode)}
              >
                {episode.status === "published" ? "View Episode" : "Continue Episode"}
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={13} />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          onDelete(episode.id);
          setConfirmDelete(false);
        }}
        title="Delete Episode"
        message={`Are you sure you want to delete "${episode.title}"? This action cannot be undone and will remove all associated exports and show notes.`}
        confirmLabel="Delete Episode"
        confirmVariant="danger"
      />
    </>
  );
}

export function Library() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const { loadEpisode } = useEpisodeStore();
  const startNewEpisode = useNewEpisode();

  const { data: episodes = [], isLoading } = useQuery({
    queryKey: ["episodes"],
    queryFn: listEpisodes,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEpisode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["episodes"] });
    },
  });

  const handleContinueEpisode = async (ep: EpisodeRow) => {
    // Convert DB row to Episode type
    const episode: Episode = {
      id: ep.id,
      episode_number: ep.episode_number ?? undefined,
      title: ep.title,
      recording_date: ep.recording_date ?? undefined,
      guest_names: ep.guest_names ? JSON.parse(ep.guest_names) : undefined,
      tags: ep.tags ? JSON.parse(ep.tags) : undefined,
      original_video_path: ep.original_video_path ?? undefined,
      enhanced_video_path: ep.enhanced_video_path ?? undefined,
      status: ep.status as Episode["status"],
      created_at: ep.created_at,
      updated_at: ep.updated_at,
    };

    // Load show notes if they exist
    let showNotes = "";
    try {
      const notes = await getShowNotes(ep.id);
      if (notes.length > 0) {
        showNotes = notes[0].edited_content || notes[0].generated_content || "";
      }
    } catch {
      // ignore
    }

    loadEpisode(episode, showNotes, ep.transcript || "");
    navigate("/new-episode");
  };

  const filteredEpisodes = episodes.filter((ep) =>
    ep.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: "40px", maxWidth: "900px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: "32px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "40px",
              fontWeight: "600",
              color: "var(--color-cream)",
              lineHeight: "1.1",
              marginBottom: "4px",
            }}
          >
            Episode Library
          </h1>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--color-text-muted)",
            }}
          >
            {episodes.length} episode{episodes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          icon={<PlusCircle size={15} />}
          onClick={startNewEpisode}
        >
          New Episode
        </Button>
      </div>

      {/* Search */}
      {episodes.length > 0 && (
        <div
          style={{
            position: "relative",
            marginBottom: "20px",
          }}
        >
          <Search
            size={15}
            style={{
              position: "absolute",
              left: "13px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search episodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              height: "40px",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--color-cream)",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              paddingLeft: "38px",
              paddingRight: "12px",
              outline: "none",
              transition: "border-color 150ms ease",
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor =
                "var(--color-sage)";
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor =
                "var(--color-border)";
            }}
          />
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                height: "72px",
                backgroundColor: "var(--color-surface)",
                borderRadius: "12px",
                border: "1px solid var(--color-border)",
                opacity: 1 - i * 0.15,
              }}
            />
          ))}
        </div>
      ) : filteredEpisodes.length === 0 ? (
        episodes.length === 0 ? (
          /* True empty state */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "80px 24px",
              backgroundColor: "var(--color-surface)",
              border: "1px dashed var(--color-border)",
              borderRadius: "14px",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                backgroundColor: "rgba(122, 139, 111, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-sage)",
              }}
            >
              <Mic size={26} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "24px",
                  fontWeight: "500",
                  color: "var(--color-cream)",
                  marginBottom: "8px",
                }}
              >
                No episodes yet
              </p>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                  color: "var(--color-text-muted)",
                  lineHeight: "1.6",
                  maxWidth: "360px",
                }}
              >
                Your produced episodes will appear here. Start by creating your
                first episode.
              </p>
            </div>
            <Button
              variant="primary"
              icon={<PlusCircle size={15} />}
              onClick={startNewEpisode}
            >
              Create First Episode
            </Button>
          </div>
        ) : (
          /* No search results */
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                color: "var(--color-text-muted)",
              }}
            >
              No episodes match &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filteredEpisodes.map((episode) => (
            <EpisodeCard
              key={episode.id}
              episode={episode}
              onDelete={(id) => deleteMutation.mutate(id)}
              onContinue={handleContinueEpisode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
