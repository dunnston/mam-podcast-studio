import { useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  helperText?: string;
  errorText?: string;
  /** Leading icon inside the input */
  leadingIcon?: ReactNode;
  /** Trailing slot (overridden internally by PasswordInput) */
  trailingContent?: ReactNode;
}

export function Input({
  label,
  helperText,
  errorText,
  leadingIcon,
  trailingContent,
  id,
  disabled,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  const hasError = Boolean(errorText);

  const borderColor = hasError
    ? "#C0392B"
    : focused
    ? "var(--color-sage)"
    : "var(--color-border)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px", width: "100%" }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            fontWeight: "500",
            color: "var(--color-text-muted)",
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </label>
      )}

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          backgroundColor: disabled ? "var(--color-charcoal)" : "var(--color-surface)",
          border: `1px solid ${borderColor}`,
          borderRadius: "8px",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
          boxShadow:
            focused && !hasError ? "0 0 0 3px rgba(122, 139, 111, 0.18)" : "none",
        }}
      >
        {leadingIcon && (
          <span
            style={{
              position: "absolute",
              left: "12px",
              display: "flex",
              alignItems: "center",
              color: "var(--color-text-muted)",
              pointerEvents: "none",
            }}
          >
            {leadingIcon}
          </span>
        )}

        <input
          id={inputId}
          disabled={disabled}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={{
            width: "100%",
            height: "40px",
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: "var(--font-body)",
            fontSize: "14px",
            color: disabled ? "var(--color-text-muted)" : "var(--color-cream)",
            paddingLeft: leadingIcon ? "38px" : "12px",
            paddingRight: trailingContent ? "40px" : "12px",
            cursor: disabled ? "not-allowed" : "text",
            ...style,
          }}
          {...rest}
        />

        {trailingContent && (
          <span
            style={{
              position: "absolute",
              right: "10px",
              display: "flex",
              alignItems: "center",
              color: "var(--color-text-muted)",
            }}
          >
            {trailingContent}
          </span>
        )}
      </div>

      {(helperText || errorText) && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "12px",
            color: hasError ? "#E57373" : "var(--color-text-muted)",
          }}
        >
          {errorText ?? helperText}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PasswordInput
// ---------------------------------------------------------------------------

export type PasswordInputProps = Omit<InputProps, "type" | "trailingContent">;

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      trailingContent={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px",
            display: "flex",
            alignItems: "center",
            color: "var(--color-text-muted)",
            transition: "color 150ms ease",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "var(--color-cream)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)")
          }
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    />
  );
}
