import type { CSSProperties } from "react";

export interface ProgressBarProps {
  /** 0–100. Ignored when `indeterminate` is true. */
  value?: number;
  label?: string;
  /** Secondary description below the bar */
  sublabel?: string;
  showPercent?: boolean;
  /** When true, renders a pulsing shimmer bar for unknown progress */
  indeterminate?: boolean;
  style?: CSSProperties;
  className?: string;
}

export function ProgressBar({
  value = 0,
  label,
  sublabel,
  showPercent = true,
  indeterminate = false,
  style,
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div
      className={className}
      style={{ display: "flex", flexDirection: "column", gap: "7px", ...style }}
    >
      {/* Header row */}
      {(label || (showPercent && !indeterminate)) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          {label && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                fontWeight: "500",
                color: "var(--color-cream)",
              }}
            >
              {label}
            </span>
          )}
          {showPercent && !indeterminate && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                fontWeight: "500",
                color: "var(--color-sage)",
              }}
            >
              {pct.toFixed(0)}%
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        style={{
          width: "100%",
          height: "6px",
          backgroundColor: "var(--color-border)",
          borderRadius: "99px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {indeterminate ? (
          <>
            {/* Shimmer fill */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, transparent 0%, var(--color-sage) 40%, var(--color-sage-light) 60%, transparent 100%)",
                backgroundSize: "200% 100%",
                animation: "progressShimmer 1.6s ease-in-out infinite",
              }}
            />
            <style>{`
              @keyframes progressShimmer {
                0%   { background-position: 200% center; }
                100% { background-position: -200% center; }
              }
            `}</style>
          </>
        ) : (
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              backgroundColor: "var(--color-sage)",
              borderRadius: "99px",
              transition: "width 400ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        )}
      </div>

      {sublabel && (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "12px",
            color: "var(--color-text-muted)",
          }}
        >
          {sublabel}
        </span>
      )}
    </div>
  );
}
