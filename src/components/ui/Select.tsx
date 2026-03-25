import { useState } from "react";
import type { CSSProperties } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: CSSProperties;
  className?: string;
  id?: string;
}

export function Select({
  options,
  value,
  onChange,
  label,
  placeholder = "Select...",
  helperText,
  errorText,
  disabled = false,
  fullWidth = true,
  style,
  className,
  id,
}: SelectProps) {
  const [focused, setFocused] = useState(false);
  const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  const hasError = Boolean(errorText);

  const borderColor = hasError
    ? "#C0392B"
    : focused
    ? "var(--color-sage)"
    : "var(--color-border)";

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        width: fullWidth ? "100%" : undefined,
      }}
    >
      {label && (
        <label
          htmlFor={selectId}
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

      <div style={{ position: "relative", width: "100%" }}>
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            height: "40px",
            fontFamily: "var(--font-body)",
            fontSize: "14px",
            color: value ? "var(--color-cream)" : "var(--color-text-muted)",
            backgroundColor: disabled
              ? "var(--color-charcoal)"
              : "var(--color-surface)",
            border: `1px solid ${borderColor}`,
            borderRadius: "8px",
            padding: "0 40px 0 12px",
            outline: "none",
            transition: "border-color 150ms ease, box-shadow 150ms ease",
            boxShadow:
              focused && !hasError
                ? "0 0 0 3px rgba(122, 139, 111, 0.18)"
                : "none",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            appearance: "none",
            WebkitAppearance: "none",
            ...style,
          }}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={opt.disabled}
              style={{
                backgroundColor: "var(--color-surface-light)",
                color: "var(--color-cream)",
              }}
            >
              {opt.label}
            </option>
          ))}
        </select>

        <span
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--color-text-muted)",
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            transition: "transform 150ms ease",
          }}
        >
          <ChevronDown size={15} />
        </span>
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
