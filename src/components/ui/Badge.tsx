import type { CSSProperties, ReactNode } from "react";

export type BadgeVariant =
  | "default"
  | "warning"
  | "info"
  | "coming-soon"
  | "success"
  | "error";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  style?: CSSProperties;
  className?: string;
}

const variantStyles: Record<BadgeVariant, CSSProperties> = {
  /** sage — primary accent */
  default: {
    backgroundColor: "rgba(122, 139, 111, 0.20)",
    color: "var(--color-sage-light)",
    border: "1px solid rgba(122, 139, 111, 0.30)",
  },
  /** terracotta — draws attention */
  warning: {
    backgroundColor: "rgba(196, 116, 90, 0.15)",
    color: "var(--color-terracotta-light)",
    border: "1px solid rgba(196, 116, 90, 0.28)",
  },
  /** blue — neutral information */
  info: {
    backgroundColor: "rgba(52, 152, 219, 0.15)",
    color: "#5DADE2",
    border: "1px solid rgba(52, 152, 219, 0.28)",
  },
  /** muted — low-contrast placeholder state */
  "coming-soon": {
    backgroundColor: "var(--color-border)",
    color: "var(--color-text-muted)",
    border: "1px solid transparent",
  },
  /** green tinted — positive state */
  success: {
    backgroundColor: "rgba(122, 139, 111, 0.20)",
    color: "var(--color-sage-light)",
    border: "1px solid rgba(122, 139, 111, 0.30)",
  },
  /** red — destructive / error */
  error: {
    backgroundColor: "rgba(192, 57, 43, 0.15)",
    color: "#E57373",
    border: "1px solid rgba(192, 57, 43, 0.28)",
  },
};

export function Badge({
  children,
  variant = "default",
  size = "sm",
  style,
  className,
}: BadgeProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font-body)",
        fontSize: size === "sm" ? "10px" : "12px",
        fontWeight: "600",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: size === "sm" ? "2px 7px" : "4px 10px",
        borderRadius: "5px",
        whiteSpace: "nowrap",
        lineHeight: 1.5,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
