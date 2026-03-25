import { useState, useRef, useEffect } from "react";
import {
  ArrowRight,
  Download,
  Image as ImageIcon,
} from "lucide-react";
import { toPng } from "html-to-image";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { Button } from "../../components/ui/Button";
import { useEpisodeStore } from "../../stores/episodeStore";
import type { ThumbnailConfig } from "../../stores/episodeStore";
import { getDefaultConfig } from "../../lib/thumbnailTemplates";
import { saveThumbnail } from "../../lib/database";
import { ThumbnailPreview } from "../../components/thumbnail/ThumbnailPreview";
import { TemplateSelector } from "../../components/thumbnail/TemplateSelector";
import { FrameCapture } from "../../components/thumbnail/FrameCapture";

export function ThumbnailStep() {
  const {
    currentEpisode,
    thumbnailConfig,
    setThumbnailConfig,
    setThumbnailExportedPath,
    setCurrentStep,
  } = useEpisodeStore();

  const previewRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedPath, setExportedPath] = useState<string | null>(null);

  // Initialize config from episode data on mount
  useEffect(() => {
    if (!thumbnailConfig) {
      const guestNames = currentEpisode?.guest_names || [];
      const config = getDefaultConfig(
        currentEpisode?.title,
        guestNames,
        currentEpisode?.episode_number
      );
      setThumbnailConfig(config);
    }
  }, []);

  const config = thumbnailConfig || getDefaultConfig();

  const updateConfig = (updates: Partial<ThumbnailConfig>) => {
    setThumbnailConfig({ ...config, ...updates });
  };

  const handleExport = async () => {
    if (!previewRef.current) return;
    setIsExporting(true);
    try {
      // Temporarily remove scale transform for full-size export
      const node = previewRef.current;
      const originalTransform = node.style.transform;
      node.style.transform = "scale(1)";

      const dataUrl = await toPng(node, {
        width: 1280,
        height: 720,
        pixelRatio: 1,
      });

      // Restore scale transform
      node.style.transform = originalTransform;

      const epNum = currentEpisode?.episode_number || 0;
      const defaultName = `MAM-EP${epNum}-thumbnail.png`;

      const path = await save({
        defaultPath: defaultName,
        filters: [{ name: "PNG Image", extensions: ["png"] }],
      });
      if (!path) {
        setIsExporting(false);
        return;
      }

      const base64 = dataUrl.split(",")[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      await writeFile(path, bytes);

      setExportedPath(path);
      setThumbnailExportedPath(path);

      // Save to database
      if (currentEpisode?.id) {
        await saveThumbnail({
          episode_id: currentEpisode.id,
          template_id: config.templateId,
          config_json: JSON.stringify(config),
          exported_path: path,
        });
      }
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleContinue = async () => {
    // Save thumbnail config to DB if not exported
    if (currentEpisode?.id && config.photos.length > 0 && !exportedPath) {
      await saveThumbnail({
        episode_id: currentEpisode.id,
        template_id: config.templateId,
        config_json: JSON.stringify(config),
      });
    }
    setCurrentStep("review");
  };

  const videoPath =
    currentEpisode?.enhanced_video_path || currentEpisode?.original_video_path || "";

  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "13px",
    fontWeight: "600",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: "var(--color-text-muted)",
    marginBottom: "12px",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "13px",
    fontWeight: "500",
    color: "var(--color-cream)",
    marginBottom: "6px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Section: Frame Capture */}
      <div>
        <p style={sectionTitleStyle}>
          <ImageIcon
            size={13}
            style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px" }}
          />
          Capture Frames from Video
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--color-text-muted)",
            marginBottom: "16px",
          }}
        >
          Enter timestamps to extract frames from your video. Use "Cut out" to remove
          backgrounds for the thumbnail.
        </p>
        <FrameCapture
          videoPath={videoPath}
          onPhotosChange={(photos) => updateConfig({ photos })}
        />
      </div>

      {/* Section: Template */}
      <div>
        <p style={sectionTitleStyle}>Choose Template</p>
        <TemplateSelector
          selectedId={config.templateId}
          onSelect={(id) => updateConfig({ templateId: id })}
        />
      </div>

      {/* Section: Content */}
      <div>
        <p style={sectionTitleStyle}>Customize Text</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Headline */}
          <div>
            <p style={labelStyle}>Headline</p>
            <input
              value={config.headline}
              onChange={(e) => updateConfig({ headline: e.target.value })}
              placeholder="YOUR HEADLINE HERE"
              style={{
                width: "100%",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                fontWeight: "600",
                color: "var(--color-cream)",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                padding: "10px 14px",
                outline: "none",
              }}
            />
          </div>

          {/* Subline and Episode Label row */}
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 2 }}>
              <p style={labelStyle}>Subline</p>
              <input
                value={config.subline}
                onChange={(e) => updateConfig({ subline: e.target.value })}
                placeholder="with Guest Name"
                style={{
                  width: "100%",
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                  color: "var(--color-cream)",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>Episode Label</p>
              <input
                value={config.episodeLabel}
                onChange={(e) => updateConfig({ episodeLabel: e.target.value })}
                placeholder="Ep 42"
                style={{
                  width: "100%",
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                  color: "var(--color-cream)",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Colors */}
          <div style={{ display: "flex", gap: "16px" }}>
            {[
              { label: "Accent Color", key: "accentColor" as const, value: config.accentColor },
              { label: "Background", key: "backgroundColor" as const, value: config.backgroundColor },
              { label: "Text Color", key: "textColor" as const, value: config.textColor },
            ].map((color) => (
              <div key={color.key} style={{ flex: 1 }}>
                <p style={labelStyle}>{color.label}</p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 10px",
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                  }}
                >
                  <input
                    type="color"
                    value={color.value}
                    onChange={(e) => updateConfig({ [color.key]: e.target.value })}
                    style={{
                      width: "28px",
                      height: "28px",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      padding: 0,
                      backgroundColor: "transparent",
                    }}
                  />
                  <input
                    type="text"
                    value={color.value}
                    onChange={(e) => updateConfig({ [color.key]: e.target.value })}
                    style={{
                      flex: 1,
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      color: "var(--color-cream)",
                      backgroundColor: "transparent",
                      border: "none",
                      outline: "none",
                      textTransform: "uppercase",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section: Preview */}
      <div>
        <p style={sectionTitleStyle}>Preview (1280 x 720)</p>
        <ThumbnailPreview ref={previewRef} config={config} scale={0.5} />
      </div>

      {/* Export status */}
      {exportedPath && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "rgba(122, 139, 111, 0.1)",
            border: "1px solid rgba(122, 139, 111, 0.3)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Download size={14} style={{ color: "var(--color-sage)" }} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--color-sage)",
            }}
          >
            Exported to: {exportedPath}
          </span>
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={() => setCurrentStep("review")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--color-text-muted)",
            textDecoration: "underline",
          }}
        >
          Skip thumbnail
        </button>
        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            variant="secondary"
            size="lg"
            icon={<Download size={16} />}
            onClick={handleExport}
            loading={isExporting}
          >
            Export PNG
          </Button>
          <Button
            variant="primary"
            size="lg"
            icon={<ArrowRight size={16} />}
            onClick={handleContinue}
          >
            Continue to Review
          </Button>
        </div>
      </div>
    </div>
  );
}
