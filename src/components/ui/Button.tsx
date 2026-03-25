import type { ButtonHTMLAttributes, CSSProperties, ReactNode, MouseEvent } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, CSSProperties> = {
  primary: {
    backgroundColor: "var(--color-terracotta)",
    color: "var(--color-cream)",
    border: "1px solid transparent",
  },
  secondary: {
    backgroundColor: "var(--color-surface-light)",
    color: "var(--color-cream)",
    border: "1px solid var(--color-border)",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "var(--color-text-muted)",
    border: "1px solid transparent",
  },
  danger: {
    backgroundColor: "#C0392B",
    color: "#fff",
    border: "1px solid transparent",
  },
};

const variantHover: Record<NonNullable<ButtonProps["variant"]>, CSSProperties> = {
  primary: {
    backgroundColor: "var(--color-terracotta-dark)",
  },
  secondary: {
    backgroundColor: "var(--color-surface)",
    borderColor: "var(--color-text-muted)",
  },
  ghost: {
    backgroundColor: "var(--color-surface)",
    color: "var(--color-cream)",
  },
  danger: {
    backgroundColor: "#A93226",
  },
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, CSSProperties> = {
  sm: {
    fontSize: "12px",
    fontWeight: "500",
    padding: "6px 12px",
    gap: "6px",
    borderRadius: "6px",
    height: "32px",
  },
  md: {
    fontSize: "14px",
    fontWeight: "500",
    padding: "8px 16px",
    gap: "8px",
    borderRadius: "8px",
    height: "40px",
  },
  lg: {
    fontSize: "15px",
    fontWeight: "500",
    padding: "10px 20px",
    gap: "8px",
    borderRadius: "9px",
    height: "48px",
  },
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  children,
  style,
  className,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-body)",
    letterSpacing: "0.01em",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.5 : 1,
    width: fullWidth ? "100%" : undefined,
    transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease, opacity 150ms ease",
    outline: "none",
    textDecoration: "none",
    whiteSpace: "nowrap",
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style,
  };

  const handleMouseEnter = (e: MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) {
      Object.assign(e.currentTarget.style, variantHover[variant]);
    }
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: MouseEvent<HTMLButtonElement>) => {
    if (!isDisabled) {
      Object.assign(e.currentTarget.style, variantStyles[variant]);
    }
    onMouseLeave?.(e);
  };

  return (
    <button
      disabled={isDisabled}
      style={baseStyle}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...rest}
    >
      {loading ? (
        <Loader2
          size={size === "sm" ? 13 : size === "lg" ? 17 : 15}
          style={{ animation: "spin 1s linear infinite" }}
        />
      ) : (
        icon && (
          <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {icon}
          </span>
        )
      )}
      {children && (
        <span>{children}</span>
      )}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}
