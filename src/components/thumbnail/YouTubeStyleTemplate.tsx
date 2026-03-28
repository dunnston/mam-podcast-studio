import type { ThumbnailConfig, PhotoPosition } from "../../stores/episodeStore";
import { DraggablePhoto } from "./DraggablePhoto";

const WIDTH = 1280;
const HEIGHT = 720;

interface YouTubeStyleTemplateProps {
  config: ThumbnailConfig;
  scale?: number;
  onPhotoPositionChange?: (index: number, pos: PhotoPosition) => void;
}

export function YouTubeStyleTemplate({
  config,
  scale = 0.5,
  onPhotoPositionChange,
}: YouTubeStyleTemplateProps) {
  const title1 = config.title1;
  const title2 = config.title2;
  const positions = config.photoPositions || [];

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'DM Sans', 'Inter', 'Helvetica Neue', sans-serif",
        backgroundColor: "#111",
      }}
    >
      {/* Background image */}
      {config.backgroundImage ? (
        <img
          src={config.backgroundImage}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: WIDTH,
            height: HEIGHT,
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: WIDTH,
            height: HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1A1A2E",
          }}
        >
          <span
            style={{
              fontSize: 20,
              color: "rgba(255,255,255,0.2)",
              fontStyle: "italic",
            }}
          >
            Upload a background image
          </span>
        </div>
      )}

      {/* Stacked title bars */}
      {(title1?.text || title2?.text) && (
        <div
          style={{
            position: "absolute",
            top: 30,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
          }}
        >
          {title1 && title1.text && (
            <div
              style={{
                backgroundColor: title1.bgColor,
                border: `${title1.borderWidth}px solid ${title1.borderColor}`,
                padding: "10px 32px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              }}
            >
              <span
                style={{
                  fontSize: title1.fontSize,
                  fontWeight: 900,
                  color: title1.textColor,
                  textTransform: "uppercase",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                }}
              >
                {title1.text}
              </span>
            </div>
          )}
          {title2 && title2.text && (
            <div
              style={{
                backgroundColor: title2.bgColor,
                border: `${title2.borderWidth}px solid ${title2.borderColor}`,
                padding: "8px 28px",
                marginTop: -(title1?.borderWidth ?? 0),
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              }}
            >
              <span
                style={{
                  fontSize: title2.fontSize,
                  fontWeight: 800,
                  color: title2.textColor,
                  textTransform: "uppercase",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                }}
              >
                {title2.text}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Guest cutout photos */}
      {config.photos.map((photo, i) => {
        const pos = positions[i] || { x: 640, y: 450, scale: 1.0 };
        return onPhotoPositionChange ? (
          <DraggablePhoto
            key={i}
            src={photo}
            position={pos}
            previewScale={scale}
            onPositionChange={(newPos) => onPhotoPositionChange(i, newPos)}
          />
        ) : (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%) scale(${pos.scale})`,
              zIndex: 10,
            }}
          >
            <img
              src={photo}
              alt={`Guest ${i + 1}`}
              style={{
                height: 500,
                width: "auto",
                filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.5))",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
