import { useRef, useCallback } from "react";
import type { PhotoPosition } from "../../stores/episodeStore";

interface DraggablePhotoProps {
  src: string;
  position: PhotoPosition;
  previewScale: number;
  onPositionChange: (pos: PhotoPosition) => void;
}

export function DraggablePhoto({
  src,
  position,
  previewScale,
  onPositionChange,
}: DraggablePhotoProps) {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPosX: position.x,
        startPosY: position.y,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current || !dragRef.current) return;
        const dx = (ev.clientX - dragRef.current.startX) / previewScale;
        const dy = (ev.clientY - dragRef.current.startY) / previewScale;
        onPositionChange({
          ...position,
          x: dragRef.current.startPosX + dx,
          y: dragRef.current.startPosY + dy,
        });
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        dragRef.current = null;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [position, previewScale, onPositionChange]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${position.x}px, ${position.y}px) translate(-50%, -50%) scale(${position.scale})`,
        cursor: isDragging.current ? "grabbing" : "grab",
        userSelect: "none",
        zIndex: 10,
      }}
    >
      <img
        src={src}
        alt="Guest cutout"
        draggable={false}
        style={{
          height: 500,
          width: "auto",
          filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.5))",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
