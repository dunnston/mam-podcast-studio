import type { ComponentType } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  PlusCircle,
  Library,
  Upload,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useUIStore } from "../stores/uiStore";

interface NavItem {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  path: string;
  disabled?: boolean;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "New Episode", icon: PlusCircle, path: "/new-episode" },
  { label: "Episode Library", icon: Library, path: "/library" },
  {
    label: "Publish",
    icon: Upload,
    path: "/publish",
    disabled: true,
    badge: "Coming Soon",
  },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className="fixed left-0 top-0 h-full z-40 flex flex-col no-select"
      style={{
        width: sidebarCollapsed ? "64px" : "240px",
        backgroundColor: "var(--color-surface-light)",
        borderRight: "1px solid var(--color-border)",
        transition: "width 200ms ease",
        overflow: "hidden",
      }}
    >
      {/* Brand header */}
      <div
        className="flex items-center no-drag"
        style={{
          height: "64px",
          minHeight: "64px",
          paddingLeft: sidebarCollapsed ? "0" : "20px",
          paddingRight: "12px",
          borderBottom: "1px solid var(--color-border)",
          justifyContent: sidebarCollapsed ? "center" : "flex-start",
          gap: "10px",
          transition: "padding 200ms ease",
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: "32px",
            height: "32px",
            minWidth: "32px",
            borderRadius: "8px",
            background:
              "linear-gradient(135deg, var(--color-sage) 0%, var(--color-sage-dark) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "16px",
              fontWeight: "700",
              color: "var(--color-cream)",
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            M
          </span>
        </div>

        {/* Brand text — hidden when collapsed */}
        <div
          style={{
            opacity: sidebarCollapsed ? 0 : 1,
            transform: sidebarCollapsed ? "translateX(-8px)" : "translateX(0)",
            transition: "opacity 150ms ease, transform 150ms ease",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "17px",
              fontWeight: "600",
              color: "var(--color-cream)",
              lineHeight: 1.15,
              letterSpacing: "0.01em",
            }}
          >
            MAM Podcast
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "10px",
              fontWeight: "500",
              color: "var(--color-text-muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Studio
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 no-drag"
        style={{ padding: "12px 8px", overflowY: "auto", overflowX: "hidden" }}
      >
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "2px" }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <li key={item.path}>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => !item.disabled && navigate(item.path)}
                    disabled={item.disabled}
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: sidebarCollapsed ? "10px 0" : "10px 12px",
                      justifyContent: sidebarCollapsed ? "center" : "flex-start",
                      borderRadius: "8px",
                      border: "none",
                      cursor: item.disabled ? "not-allowed" : "pointer",
                      opacity: item.disabled ? 0.5 : 1,
                      transition: "background-color 150ms ease, color 150ms ease",
                      backgroundColor: active
                        ? "var(--color-sage)"
                        : "transparent",
                      color: active
                        ? "var(--color-cream)"
                        : "var(--color-text-muted)",
                      fontFamily: "var(--font-body)",
                      fontSize: "14px",
                      fontWeight: active ? "500" : "400",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                    onMouseEnter={(e) => {
                      if (!active && !item.disabled) {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                          "var(--color-surface)";
                        (e.currentTarget as HTMLButtonElement).style.color =
                          "var(--color-cream)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                          "transparent";
                        (e.currentTarget as HTMLButtonElement).style.color =
                          "var(--color-text-muted)";
                      }
                    }}
                  >
                    <span style={{ minWidth: "18px", flexShrink: 0, display: "inline-flex" }}>
                      <Icon size={18} />
                    </span>

                    {/* Label + badge — hidden when collapsed */}
                    <span
                      style={{
                        opacity: sidebarCollapsed ? 0 : 1,
                        transition: "opacity 150ms ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        overflow: "hidden",
                        flex: 1,
                      }}
                    >
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: "600",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: "var(--color-border)",
                            color: "var(--color-text-muted)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div
        className="no-drag"
        style={{
          padding: "12px 8px",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: sidebarCollapsed ? "10px 0" : "10px 12px",
            justifyContent: sidebarCollapsed ? "center" : "flex-start",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            backgroundColor: "transparent",
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: "400",
            transition: "background-color 150ms ease, color 150ms ease",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "var(--color-surface)";
            (e.currentTarget as HTMLButtonElement).style.color =
              "var(--color-cream)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "transparent";
            (e.currentTarget as HTMLButtonElement).style.color =
              "var(--color-text-muted)";
          }}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen size={18} style={{ minWidth: "18px", flexShrink: 0 }} />
          ) : (
            <PanelLeftClose size={18} style={{ minWidth: "18px", flexShrink: 0 }} />
          )}
          <span
            style={{
              opacity: sidebarCollapsed ? 0 : 1,
              transition: "opacity 150ms ease",
            }}
          >
            Collapse
          </span>
        </button>
      </div>
    </aside>
  );
}
