import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  PlusCircle,
  Library,
  Settings,
  Mic,
  Clock,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { listEpisodes } from "../lib/database";
import type { EpisodeRow } from "../lib/database";
import { Badge } from "../components/ui/Badge";
import type { BadgeVariant } from "../components/ui/Badge";

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

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  onClick: () => void;
  large?: boolean;
}

function QuickActionCard({
  title,
  description,
  icon,
  accentColor,
  accentBg,
  onClick,
  large = false,
}: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "12px",
        padding: large ? "28px" : "20px",
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "14px",
        cursor: "pointer",
        transition:
          "border-color 150ms ease, background-color 150ms ease, transform 150ms ease",
        textAlign: "left",
        width: "100%",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = accentColor;
        el.style.backgroundColor = "var(--color-surface-light)";
        el.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = "var(--color-border)";
        el.style.backgroundColor = "var(--color-surface)";
        el.style.transform = "translateY(0)";
      }}
    >
      <div
        style={{
          width: large ? "48px" : "40px",
          height: large ? "48px" : "40px",
          borderRadius: "10px",
          backgroundColor: accentBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: accentColor,
        }}
      >
        {icon}
      </div>
      <div>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: large ? "16px" : "15px",
            fontWeight: "600",
            color: "var(--color-cream)",
            marginBottom: "4px",
          }}
        >
          {title}
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--color-text-muted)",
            lineHeight: "1.5",
          }}
        >
          {description}
        </p>
      </div>
    </button>
  );
}

export function Dashboard() {
  const navigate = useNavigate();

  const { data: episodes = [], isLoading } = useQuery({
    queryKey: ["episodes"],
    queryFn: listEpisodes,
  });

  const recentEpisodes = episodes.slice(0, 5);

  return (
    <div style={{ padding: "48px 40px", maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ marginBottom: "48px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "8px",
          }}
        >
          <Sparkles size={18} style={{ color: "var(--color-sage)" }} />
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              fontWeight: "600",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-sage)",
            }}
          >
            Podcast Studio
          </span>
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "52px",
            fontWeight: "600",
            color: "var(--color-cream)",
            lineHeight: "1.1",
            letterSpacing: "-0.01em",
            marginBottom: "8px",
          }}
        >
          Modern Ancestral Mamas
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "16px",
            color: "var(--color-text-muted)",
          }}
        >
          Your podcast production workflow, simplified.
        </p>
      </div>

      {/* Quick Actions */}
      <section style={{ marginBottom: "48px" }}>
        <h2
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "11px",
            fontWeight: "600",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            marginBottom: "16px",
          }}
        >
          Quick Actions
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr",
            gap: "12px",
          }}
        >
          <QuickActionCard
            title="New Episode"
            description="Import video, enhance audio, extract tracks, and generate show notes."
            icon={<PlusCircle size={24} />}
            accentColor="var(--color-terracotta)"
            accentBg="rgba(196, 116, 90, 0.15)"
            onClick={() => navigate("/new-episode")}
            large
          />
          <QuickActionCard
            title="Episode Library"
            description="Browse and manage all your recorded episodes."
            icon={<Library size={20} />}
            accentColor="var(--color-sage)"
            accentBg="rgba(122, 139, 111, 0.15)"
            onClick={() => navigate("/library")}
          />
          <QuickActionCard
            title="Settings"
            description="Configure output paths, API keys, and templates."
            icon={<Settings size={20} />}
            accentColor="var(--color-text-muted)"
            accentBg="var(--color-surface-light)"
            onClick={() => navigate("/settings")}
          />
        </div>
      </section>

      {/* Recent Episodes */}
      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "11px",
              fontWeight: "600",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
            }}
          >
            Recent Episodes
          </h2>
          {episodes.length > 0 && (
            <button
              onClick={() => navigate("/library")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
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
              View all
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {isLoading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                style={{
                  height: "64px",
                  backgroundColor: "var(--color-surface)",
                  borderRadius: "10px",
                  border: "1px solid var(--color-border)",
                  animation: "pulse 1.5s ease-in-out infinite",
                  opacity: 1 - i * 0.2,
                }}
              />
            ))}
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 0.3; }
              }
            `}</style>
          </div>
        ) : recentEpisodes.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "64px 24px",
              backgroundColor: "var(--color-surface)",
              border: "1px dashed var(--color-border)",
              borderRadius: "14px",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "rgba(122, 139, 111, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-sage)",
              }}
            >
              <Mic size={24} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "22px",
                  fontWeight: "500",
                  color: "var(--color-cream)",
                  marginBottom: "6px",
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
                }}
              >
                Create your first episode to get started with your podcast
                production workflow.
              </p>
            </div>
            <button
              onClick={() => navigate("/new-episode")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
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
              <PlusCircle size={16} />
              Create First Episode
            </button>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            {recentEpisodes.map((ep: EpisodeRow, index: number) => (
              <button
                key={ep.id}
                onClick={() => navigate("/library")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  width: "100%",
                  padding: "16px 20px",
                  backgroundColor: "transparent",
                  border: "none",
                  borderBottom:
                    index < recentEpisodes.length - 1
                      ? "1px solid var(--color-border)"
                      : "none",
                  cursor: "pointer",
                  transition: "background-color 150ms ease",
                  textAlign: "left",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "var(--color-surface-light)")
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
                    {ep.episode_number ?? "—"}
                  </span>
                </div>

                {/* Title and date */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "var(--color-cream)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginBottom: "3px",
                    }}
                  >
                    {ep.title}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Clock size={11} style={{ color: "var(--color-text-muted)" }} />
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "12px",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {formatDate(ep.created_at)}
                    </span>
                  </div>
                </div>

                {/* Status badge */}
                <Badge variant={statusVariant(ep.status)}>{ep.status}</Badge>

                <ChevronRight
                  size={16}
                  style={{ color: "var(--color-border)", flexShrink: 0 }}
                />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
