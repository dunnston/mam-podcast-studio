import type { CSSProperties, ReactNode } from "react";

export interface CardProps {
  children?: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
  /** Lift the card slightly (stronger shadow) */
  elevated?: boolean;
}

export interface CardHeaderProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export interface CardBodyProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export interface CardFooterProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const paddingMap = {
  none: "0",
  sm: "12px",
  md: "20px",
  lg: "28px",
};

export function Card({
  children,
  padding = "md",
  className,
  style,
  elevated = false,
}: CardProps) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: elevated
          ? "0 4px 24px rgba(0, 0, 0, 0.3)"
          : "0 1px 4px rgba(0, 0, 0, 0.2)",
        padding: padding === "none" ? undefined : paddingMap[padding],
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, style }: CardHeaderProps) {
  return (
    <div
      className={className}
      style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className, style }: CardBodyProps) {
  return (
    <div
      className={className}
      style={{
        padding: "20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardFooter({ children, className, style }: CardFooterProps) {
  return (
    <div
      className={className}
      style={{
        padding: "14px 20px",
        borderTop: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "10px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
