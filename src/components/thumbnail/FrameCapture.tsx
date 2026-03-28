import { useState, useRef } from "react";
import {
  Camera,
  Trash2,
  Loader2,
  Plus,
  Scissors,
} from "lucide-react";
import { Button } from "../ui/Button";
import { extractFrame, removeBackground } from "../../lib/tauri";
import { useSettingsStore } from "../../stores/settingsStore";
import { readFile } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";

interface FrameSlot {
  id: number;
  timestamp: string; // HH:MM:SS
  rawFrame: string | null; // base64 data URL of raw frame
  cutoutFrame: string | null; // base64 data URL after bg removal
  isCapturing: boolean;
  isRemoving: boolean;
  error: string | null;
}

interface FrameCaptureProps {
  videoPath: string;
  onPhotosChange: (photos: string[]) => void;
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function FrameCapture({ videoPath, onPhotosChange }: FrameCaptureProps) {
  const nextSlotIdRef = useRef(1);
  const nextId = () => nextSlotIdRef.current++;
  const [slots, setSlots] = useState<FrameSlot[]>(() => [
    { id: nextId(), timestamp: "00:00:30", rawFrame: null, cutoutFrame: null, isCapturing: false, isRemoving: false, error: null },
    { id: nextId(), timestamp: "00:01:00", rawFrame: null, cutoutFrame: null, isCapturing: false, isRemoving: false, error: null },
  ]);
  const removeBgApiKey = useSettingsStore((s) => s.removeBgApiKey);

  const updateSlot = (id: number, updates: Partial<FrameSlot>) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const syncPhotos = (updatedSlots: FrameSlot[]) => {
    const newPhotos = updatedSlots
      .map((s) => s.cutoutFrame || s.rawFrame)
      .filter(Boolean) as string[];
    onPhotosChange(newPhotos);
  };

  const handleCapture = async (slot: FrameSlot) => {
    if (!videoPath) return;
    updateSlot(slot.id, { isCapturing: true, error: null });
    try {
      const secs = parseTimestamp(slot.timestamp);
      const dataDir = await appDataDir();
      const outputPath = await join(dataDir, `frame_${slot.id}_${Date.now()}.png`);
      await extractFrame(videoPath, secs, outputPath);

      // Read the extracted frame as base64
      const fileBytes = await readFile(outputPath);
      const base64 = btoa(
        Array.from(fileBytes)
          .map((b) => String.fromCharCode(b))
          .join("")
      );
      const dataUrl = `data:image/png;base64,${base64}`;

      updateSlot(slot.id, { rawFrame: dataUrl, cutoutFrame: null, isCapturing: false });

      // Sync photos
      const updated = slots.map((s) =>
        s.id === slot.id ? { ...s, rawFrame: dataUrl, cutoutFrame: null, isCapturing: false } : s
      );
      syncPhotos(updated);
    } catch (e) {
      updateSlot(slot.id, {
        isCapturing: false,
        error: `Capture failed: ${e}`,
      });
    }
  };

  const handleRemoveBg = async (slot: FrameSlot) => {
    if (!slot.rawFrame || !removeBgApiKey) return;
    updateSlot(slot.id, { isRemoving: true, error: null });
    try {
      // Write the raw frame to a temp file for the API
      const dataDir = await appDataDir();
      const tempPath = await join(dataDir, `rembg_input_${slot.id}.png`);

      // Decode base64 and write
      const { writeFile: tauriWriteFile } = await import("@tauri-apps/plugin-fs");
      const b64Data = slot.rawFrame.split(",")[1];
      const binary = atob(b64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      await tauriWriteFile(tempPath, bytes);

      const result = await removeBackground(tempPath, removeBgApiKey);

      updateSlot(slot.id, { cutoutFrame: result, isRemoving: false });

      // Sync photos
      const updated = slots.map((s) =>
        s.id === slot.id ? { ...s, cutoutFrame: result, isRemoving: false } : s
      );
      syncPhotos(updated);
    } catch (e) {
      updateSlot(slot.id, {
        isRemoving: false,
        error: `Background removal failed: ${e}`,
      });
    }
  };

  const handleAddSlot = () => {
    if (slots.length >= 4) return;
    setSlots((prev) => [
      ...prev,
      {
        id: nextId(),
        timestamp: "00:00:00",
        rawFrame: null,
        cutoutFrame: null,
        isCapturing: false,
        isRemoving: false,
        error: null,
      },
    ]);
  };

  const handleRemoveSlot = (id: number) => {
    const updated = slots.filter((s) => s.id !== id);
    setSlots(updated);
    syncPhotos(updated);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {slots.map((slot, index) => (
        <div
          key={slot.id}
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
            padding: "16px",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "10px",
          }}
        >
          {/* Timestamp + capture */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "160px" }}>
            <label
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "12px",
                fontWeight: "600",
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Photo {index + 1} Timestamp
            </label>
            <input
              type="text"
              value={slot.timestamp}
              onChange={(e) => updateSlot(slot.id, { timestamp: e.target.value })}
              placeholder="HH:MM:SS"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "14px",
                color: "var(--color-cream)",
                backgroundColor: "var(--color-charcoal)",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                padding: "8px 12px",
                outline: "none",
                width: "100%",
              }}
            />
            <div style={{ display: "flex", gap: "6px" }}>
              <Button
                variant="secondary"
                size="sm"
                icon={slot.isCapturing ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                onClick={() => handleCapture(slot)}
                disabled={slot.isCapturing || !videoPath}
              >
                {slot.isCapturing ? "..." : "Capture"}
              </Button>
              {slots.length > 2 && (
                <button
                  onClick={() => handleRemoveSlot(slot.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-text-muted)",
                    padding: "4px",
                  }}
                  title="Remove this slot"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Frame preview */}
          <div
            style={{
              flex: 1,
              display: "flex",
              gap: "12px",
              alignItems: "center",
            }}
          >
            {/* Raw frame */}
            <div
              style={{
                width: "160px",
                height: "90px",
                backgroundColor: "var(--color-charcoal)",
                borderRadius: "6px",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--color-border)",
                flexShrink: 0,
              }}
            >
              {slot.rawFrame ? (
                <img
                  src={slot.rawFrame}
                  alt="Captured frame"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "11px",
                    color: "var(--color-text-muted)",
                  }}
                >
                  No frame
                </span>
              )}
            </div>

            {/* Remove BG button */}
            {slot.rawFrame && (
              <Button
                variant="secondary"
                size="sm"
                icon={slot.isRemoving ? <Loader2 size={13} className="animate-spin" /> : <Scissors size={13} />}
                onClick={() => handleRemoveBg(slot)}
                disabled={slot.isRemoving || !removeBgApiKey}
                title={!removeBgApiKey ? "Set remove.bg API key in Settings" : "Remove background"}
              >
                {slot.isRemoving ? "..." : "Cut out"}
              </Button>
            )}

            {/* Cutout preview */}
            {slot.cutoutFrame && (
              <div
                style={{
                  width: "90px",
                  height: "90px",
                  borderRadius: "6px",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  // Checkerboard pattern for transparency
                  backgroundImage:
                    "linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)",
                  backgroundSize: "10px 10px",
                  backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0px",
                  border: "1px solid var(--color-border)",
                }}
              >
                <img
                  src={slot.cutoutFrame}
                  alt="Cutout"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
            )}
          </div>

          {/* Error */}
          {slot.error && (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                color: "#E57373",
                marginTop: "4px",
              }}
            >
              {slot.error}
            </p>
          )}
        </div>
      ))}

      {/* Add slot button */}
      {slots.length < 4 && (
        <button
          onClick={handleAddSlot}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "12px",
            backgroundColor: "transparent",
            border: "1px dashed var(--color-border)",
            borderRadius: "10px",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--color-text-muted)",
            transition: "border-color 150ms ease, color 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--color-terracotta)";
            e.currentTarget.style.color = "var(--color-cream)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border)";
            e.currentTarget.style.color = "var(--color-text-muted)";
          }}
        >
          <Plus size={14} />
          Add another photo slot (up to 4)
        </button>
      )}

      {!removeBgApiKey && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "12px",
            color: "var(--color-text-muted)",
            fontStyle: "italic",
          }}
        >
          Set your remove.bg API key in Settings to enable automatic background removal.
        </p>
      )}
    </div>
  );
}
