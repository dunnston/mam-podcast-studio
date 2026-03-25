import { useRef, KeyboardEvent } from "react";
import type { ReactNode, CSSProperties } from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  /** Additional styles for the outer container */
  style?: CSSProperties;
  className?: string;
}

export interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, style, className }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Arrow-key keyboard navigation between tabs
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabledTabs = tabs
      .map((t, i) => ({ ...t, i }))
      .filter((t) => !t.disabled);

    const currentEnabledIndex = enabledTabs.findIndex((t) => t.id === tabs[index].id);

    let nextEnabled: (typeof enabledTabs)[number] | undefined;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextEnabled = enabledTabs[(currentEnabledIndex + 1) % enabledTabs.length];
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextEnabled =
        enabledTabs[(currentEnabledIndex - 1 + enabledTabs.length) % enabledTabs.length];
    } else if (e.key === "Home") {
      e.preventDefault();
      nextEnabled = enabledTabs[0];
    } else if (e.key === "End") {
      e.preventDefault();
      nextEnabled = enabledTabs[enabledTabs.length - 1];
    }

    if (nextEnabled) {
      onChange(nextEnabled.id);
      // Focus the button that corresponds to the new active tab
      const btn = listRef.current?.querySelector<HTMLButtonElement>(
        `[data-tab-id="${nextEnabled.id}"]`
      );
      btn?.focus();
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      className={className}
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "0",
        borderBottom: "1px solid var(--color-border)",
        ...style,
      }}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            role="tab"
            data-tab-id={tab.id}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 16px 11px",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              fontWeight: isActive ? "500" : "400",
              color: isActive ? "var(--color-cream)" : "var(--color-text-muted)",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: `2px solid ${isActive ? "var(--color-sage)" : "transparent"}`,
              marginBottom: "-1px",
              cursor: tab.disabled ? "not-allowed" : "pointer",
              opacity: tab.disabled ? 0.4 : 1,
              transition:
                "color 150ms ease, border-color 150ms ease, opacity 150ms ease",
              whiteSpace: "nowrap",
              outline: "none",
              borderRadius: "4px 4px 0 0",
            }}
            onMouseEnter={(e) => {
              if (!isActive && !tab.disabled) {
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--color-cream)";
                (e.currentTarget as HTMLButtonElement).style.borderBottomColor =
                  "var(--color-border)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.color =
                  "var(--color-text-muted)";
                (e.currentTarget as HTMLButtonElement).style.borderBottomColor =
                  "transparent";
              }
            }}
            onFocus={(e) => {
              // Visible keyboard focus ring without disrupting design
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 0 0 2px rgba(122, 139, 111, 0.5)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            {tab.icon && (
              <span style={{ display: "flex", alignItems: "center" }}>
                {tab.icon}
              </span>
            )}
            {tab.label}
            {tab.badge !== undefined && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "18px",
                  height: "18px",
                  padding: "0 5px",
                  borderRadius: "9px",
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  fontWeight: "600",
                  backgroundColor: isActive
                    ? "rgba(122, 139, 111, 0.30)"
                    : "var(--color-border)",
                  color: isActive
                    ? "var(--color-sage-light)"
                    : "var(--color-text-muted)",
                  transition: "background-color 150ms ease, color 150ms ease",
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, activeTab, children, style, className }: TabPanelProps) {
  if (id !== activeTab) return null;
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}
