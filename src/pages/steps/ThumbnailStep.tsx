import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowRight,
  Download,
  Image as ImageIcon,
  Upload,
  Trash2,
} from "lucide-react";
import { toPng } from "html-to-image";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, readFile } from "@tauri-apps/plugin-fs";
import { Button } from "../../components/ui/Button";
import { useEpisodeStore } from "../../stores/episodeStore";
import type { ThumbnailConfig, TitleBarConfig, PhotoPosition } from "../../stores/episodeStore";
import { getDefaultConfig, getDefaultPhotoPositions } from "../../lib/thumbnailTemplates";
import { saveThumbnail } from "../../lib/database";
import { ThumbnailPreview } from "../../components/thumbnail/ThumbnailPreview";
import { TemplateSelector } from "../../components/thumbnail/TemplateSelector";
import { FrameCapture } from "../../components/thumbnail/FrameCapture";
import { openImageFile } from "../../lib/tauri";

async function loadImageAsResizedBase64(filePath: string): Promise<string> {
  const fileBytes = await readFile(filePath);
  const blob = new Blob([fileBytes]);
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d")!;
      // Cover-fit: fill 1280x720 cropping as needed
      const scale = Math.max(1280 / img.width, 720 / img.height);
      const sw = 1280 / scale;
      const sh = 720 / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1280, 720);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

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
  const [exportError, setExportError] = useState<string | null>(null);
  const [isLoadingBg, setIsLoadingBg] = useState(false);

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
  const isYouTube = config.templateId === "youtube-style";

  const updateConfig = (updates: Partial<ThumbnailConfig>) => {
    setThumbnailConfig({ ...config, ...updates });
  };

  const updateTitle1 = (updates: Partial<TitleBarConfig>) => {
    updateConfig({ title1: { ...config.title1!, ...updates } });
  };

  const updateTitle2 = (updates: Partial<TitleBarConfig>) => {
    updateConfig({ title2: { ...config.title2!, ...updates } });
  };

  const handlePhotosChange = useCallback(
    (photos: string[]) => {
      const positions = getDefaultPhotoPositions(photos.length);
      // Preserve existing positions where possible
      const merged = positions.map((defaultPos, i) => {
        const existing = config.photoPositions?.[i];
        return existing || defaultPos;
      });
      updateConfig({ photos, photoPositions: merged });
    },
    [config]
  );

  const handlePhotoPositionChange = useCallback(
    (index: number, pos: PhotoPosition) => {
      const positions = [...(config.photoPositions || [])];
      positions[index] = pos;
      updateConfig({ photoPositions: positions });
    },
    [config]
  );

  const handleUploadBackground = async () => {
    const path = await openImageFile();
    if (!path) return;
    setIsLoadingBg(true);
    try {
      const dataUrl = await loadImageAsResizedBase64(path);
      updateConfig({ backgroundImage: dataUrl });
    } catch (e) {
      console.error("Failed to load background image:", e);
    } finally {
      setIsLoadingBg(false);
    }
  };

  const handleExport = async () => {
    if (!previewRef.current) return;
    setIsExporting(true);
    setExportError(null);

    const node = previewRef.current;
    const originalTransform = node.style.transform;
    try {
      // Temporarily remove scale transform for full-size export
      node.style.transform = "scale(1)";

      const dataUrl = await toPng(node, {
        width: 1280,
        height: 720,
        pixelRatio: 1,
      });

      const epNum = currentEpisode?.episode_number || 0;
      const defaultName = `MAM-EP${epNum}-thumbnail.png`;

      const path = await save({
        defaultPath: defaultName,
        filters: [{ name: "PNG Image", extensions: ["png"] }],
      });
      if (!path) {
        return;
      }

      const base64 = dataUrl.split(",")[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      await writeFile(path, bytes);

      setExportedPath(path);
      setThumbnailExportedPath(path);

      // Save to database (strip base64 blobs from config to keep DB rows small)
      if (currentEpisode?.id) {
        const configForDb = {
          ...config,
          photos: [], // Don't store base64 in DB
          backgroundImage: undefined,
        };
        await saveThumbnail({
          episode_id: currentEpisode.id,
          template_id: config.templateId,
          config_json: JSON.stringify(configForDb),
          exported_path: path,
        });
      }
    } catch (e) {
      console.error("Export failed:", e);
      setExportError(e instanceof Error ? e.message : "Export failed. Please try again.");
    } finally {
      // Always restore transform, even on error
      node.style.transform = originalTransform;
      setIsExporting(false);
    }
  };

  const handleContinue = async () => {
    // Save thumbnail config to DB if not exported (strip base64 blobs)
    if (currentEpisode?.id && config.photos.length > 0 && !exportedPath) {
      const configForDb = {
        ...config,
        photos: [], // Don't store base64 in DB
        backgroundImage: undefined,
      };
      await saveThumbnail({
        episode_id: currentEpisode.id,
        template_id: config.templateId,
        config_json: JSON.stringify(configForDb),
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

  const inputStyle: React.CSSProperties = {
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
  };

  const colorPickerStyle = (value: string, onChange: (val: string) => void) => (
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Section: Template */}
      <div>
        <p style={sectionTitleStyle}>Choose Template</p>
        <TemplateSelector
          selectedId={config.templateId}
          onSelect={(id) => updateConfig({ templateId: id })}
        />
      </div>

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
          onPhotosChange={isYouTube ? handlePhotosChange : (photos) => updateConfig({ photos })}
        />
      </div>

      {/* YouTube Style Controls */}
      {isYouTube ? (
        <>
          {/* Background Image Upload */}
          <div>
            <p style={sectionTitleStyle}>
              <Upload
                size={13}
                style={{ display: "inline", verticalAlign: "-2px", marginRight: "6px" }}
              />
              Background Image
            </p>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Upload size={14} />}
                onClick={handleUploadBackground}
                loading={isLoadingBg}
              >
                {config.backgroundImage ? "Change Image" : "Upload Image"}
              </Button>
              {config.backgroundImage && (
                <button
                  onClick={() => updateConfig({ backgroundImage: undefined })}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-text-muted)",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontFamily: "var(--font-body)",
                    fontSize: "12px",
                  }}
                >
                  <Trash2 size={13} /> Remove
                </button>
              )}
            </div>
            {config.backgroundImage && (
              <div
                style={{
                  marginTop: "10px",
                  width: "200px",
                  height: "112px",
                  borderRadius: "6px",
                  overflow: "hidden",
                  border: "1px solid var(--color-border)",
                }}
              >
                <img
                  src={config.backgroundImage}
                  alt="Background preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}
          </div>

          {/* Title 1 */}
          <div>
            <p style={sectionTitleStyle}>Title 1 (Upper)</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <p style={labelStyle}>Text</p>
                <input
                  value={config.title1?.text || ""}
                  onChange={(e) => updateTitle1({ text: e.target.value })}
                  placeholder="YOUR TITLE HERE"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <p style={labelStyle}>Background</p>
                  {colorPickerStyle(config.title1?.bgColor || "#CC0000", (v) =>
                    updateTitle1({ bgColor: v })
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={labelStyle}>Text Color</p>
                  {colorPickerStyle(config.title1?.textColor || "#FFFFFF", (v) =>
                    updateTitle1({ textColor: v })
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={labelStyle}>Border</p>
                  {colorPickerStyle(config.title1?.borderColor || "#FFFFFF", (v) =>
                    updateTitle1({ borderColor: v })
                  )}
                </div>
              </div>
              <div>
                <p style={labelStyle}>
                  Font Size: {config.title1?.fontSize || 48}px
                </p>
                <input
                  type="range"
                  min={24}
                  max={72}
                  value={config.title1?.fontSize || 48}
                  onChange={(e) => updateTitle1({ fontSize: Number(e.target.value) })}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>

          {/* Title 2 */}
          <div>
            <p style={sectionTitleStyle}>Title 2 (Lower)</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <p style={labelStyle}>Text</p>
                <input
                  value={config.title2?.text || ""}
                  onChange={(e) => updateTitle2({ text: e.target.value })}
                  placeholder="SUBTITLE HERE"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <p style={labelStyle}>Background</p>
                  {colorPickerStyle(config.title2?.bgColor || "#2E7D32", (v) =>
                    updateTitle2({ bgColor: v })
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={labelStyle}>Text Color</p>
                  {colorPickerStyle(config.title2?.textColor || "#FFFFFF", (v) =>
                    updateTitle2({ textColor: v })
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={labelStyle}>Border</p>
                  {colorPickerStyle(config.title2?.borderColor || "#FFFFFF", (v) =>
                    updateTitle2({ borderColor: v })
                  )}
                </div>
              </div>
              <div>
                <p style={labelStyle}>
                  Font Size: {config.title2?.fontSize || 36}px
                </p>
                <input
                  type="range"
                  min={20}
                  max={60}
                  value={config.title2?.fontSize || 36}
                  onChange={(e) => updateTitle2({ fontSize: Number(e.target.value) })}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>

          {/* Drag hint */}
          {config.photos.length > 0 && (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                color: "var(--color-text-muted)",
                fontStyle: "italic",
              }}
            >
              Drag guests on the preview below to reposition them.
            </p>
          )}
        </>
      ) : (
        /* Original template controls */
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
                style={inputStyle}
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
                  style={{ ...inputStyle, fontWeight: "400" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <p style={labelStyle}>Episode Label</p>
                <input
                  value={config.episodeLabel}
                  onChange={(e) => updateConfig({ episodeLabel: e.target.value })}
                  placeholder="Ep 42"
                  style={{ ...inputStyle, fontWeight: "400" }}
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
                  {colorPickerStyle(color.value, (v) => updateConfig({ [color.key]: v }))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Section: Preview */}
      <div>
        <p style={sectionTitleStyle}>Preview (1280 x 720)</p>
        <ThumbnailPreview
          ref={previewRef}
          config={config}
          scale={0.5}
          onPhotoPositionChange={isYouTube ? handlePhotoPositionChange : undefined}
        />
      </div>

      {/* Export error */}
      {exportError && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "rgba(192, 57, 43, 0.12)",
            border: "1px solid rgba(192, 57, 43, 0.25)",
            borderRadius: "8px",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "#E57373",
          }}
        >
          Export failed: {exportError}
        </div>
      )}

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
