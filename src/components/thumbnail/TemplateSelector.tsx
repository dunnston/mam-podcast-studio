import { TEMPLATES } from "../../lib/thumbnailTemplates";

interface TemplateSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function TemplateSelector({ selectedId, onSelect }: TemplateSelectorProps) {
  return (
    <div style={{ display: "flex", gap: "12px" }}>
      {TEMPLATES.map((template) => {
        const isSelected = template.id === selectedId;
        return (
          <button
            key={template.id}
            onClick={() => onSelect(template.id)}
            style={{
              flex: 1,
              padding: "16px",
              backgroundColor: isSelected
                ? "rgba(196, 116, 90, 0.12)"
                : "var(--color-surface)",
              border: `2px solid ${isSelected ? "var(--color-terracotta)" : "var(--color-border)"}`,
              borderRadius: "10px",
              cursor: "pointer",
              textAlign: "left",
              transition: "border-color 150ms ease, background-color 150ms ease",
            }}
          >
            {/* Mini preview bar */}
            <div
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "6px",
                marginBottom: "12px",
                overflow: "hidden",
                display: "flex",
              }}
            >
              {template.id === "bold-banner" ? (
                // Bold Banner mini preview
                <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: "#1A1A2E" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", backgroundColor: "#C4745A" }} />
                  <div style={{ position: "absolute", top: "12px", left: "10px", width: "50%", height: "6px", backgroundColor: "#fff", borderRadius: "2px" }} />
                  <div style={{ position: "absolute", top: "22px", left: "10px", width: "35%", height: "4px", backgroundColor: "#C4745A", borderRadius: "2px" }} />
                  <div style={{ position: "absolute", right: "10px", bottom: "4px", width: "20px", height: "30px", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "3px 3px 0 0" }} />
                  <div style={{ position: "absolute", right: "34px", bottom: "4px", width: "20px", height: "28px", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "3px 3px 0 0" }} />
                </div>
              ) : (
                // Split Panel mini preview
                <>
                  <div style={{ flex: "55%", backgroundColor: "#C4745A", padding: "8px", position: "relative" }}>
                    <div style={{ width: "70%", height: "5px", backgroundColor: "rgba(255,255,255,0.7)", borderRadius: "2px", marginBottom: "4px" }} />
                    <div style={{ width: "50%", height: "3px", backgroundColor: "rgba(255,255,255,0.4)", borderRadius: "2px" }} />
                  </div>
                  <div style={{ flex: "45%", backgroundColor: "#1A1A2E", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 6px" }}>
                    <div style={{ width: "18px", height: "28px", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "3px 3px 0 0" }} />
                  </div>
                </>
              )}
            </div>

            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                fontWeight: "600",
                color: isSelected ? "var(--color-cream)" : "var(--color-text-muted)",
                marginBottom: "4px",
              }}
            >
              {template.name}
            </p>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "12px",
                color: "var(--color-text-muted)",
                lineHeight: "1.4",
              }}
            >
              {template.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
