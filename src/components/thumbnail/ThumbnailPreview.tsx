import { forwardRef } from "react";
import type { ThumbnailConfig } from "../../stores/episodeStore";

interface ThumbnailPreviewProps {
  config: ThumbnailConfig;
  scale?: number;
}

const WIDTH = 1280;
const HEIGHT = 720;

function BoldBannerTemplate({ config }: { config: ThumbnailConfig }) {
  const photoCount = config.photos.length;

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        backgroundColor: config.backgroundColor,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'DM Sans', 'Inter', 'Helvetica Neue', sans-serif",
      }}
    >
      {/* Accent color top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "8px",
          backgroundColor: config.accentColor,
        }}
      />

      {/* Main content area */}
      <div
        style={{
          display: "flex",
          height: "100%",
          padding: "40px",
        }}
      >
        {/* Left side: Text */}
        <div
          style={{
            flex: photoCount > 0 ? "0 0 55%" : "1",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingRight: photoCount > 0 ? "30px" : "0",
            zIndex: 2,
          }}
        >
          {/* Episode label */}
          {config.episodeLabel && (
            <div
              style={{
                display: "inline-flex",
                alignSelf: "flex-start",
                padding: "6px 16px",
                backgroundColor: config.accentColor,
                borderRadius: "4px",
                marginBottom: "20px",
              }}
            >
              <span
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                {config.episodeLabel}
              </span>
            </div>
          )}

          {/* Headline */}
          <h1
            style={{
              fontSize: photoCount > 0 ? "52px" : "60px",
              fontWeight: 900,
              color: config.textColor,
              lineHeight: 1.05,
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              textShadow: "0 2px 20px rgba(0,0,0,0.3)",
            }}
          >
            {config.headline}
          </h1>

          {/* Subline */}
          {config.subline && (
            <p
              style={{
                fontSize: "26px",
                fontWeight: 500,
                color: config.accentColor,
                marginTop: "16px",
                margin: "16px 0 0 0",
              }}
            >
              {config.subline}
            </p>
          )}
        </div>

        {/* Right side: Photos */}
        {photoCount > 0 && (
          <div
            style={{
              flex: "0 0 45%",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: photoCount > 2 ? "4px" : "8px",
              position: "relative",
            }}
          >
            {config.photos.map((photo, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: "85%",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
                <img
                  src={photo}
                  alt={`Guest ${i + 1}`}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    objectPosition: "bottom center",
                    filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.4))",
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom accent line */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "6px",
          backgroundColor: config.accentColor,
        }}
      />
    </div>
  );
}

function SplitPanelTemplate({ config }: { config: ThumbnailConfig }) {
  const photoCount = config.photos.length;

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'DM Sans', 'Inter', 'Helvetica Neue', sans-serif",
      }}
    >
      {/* Left panel: Text */}
      <div
        style={{
          flex: "0 0 55%",
          backgroundColor: config.accentColor,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "50px 40px",
          position: "relative",
        }}
      >
        {/* Episode badge */}
        {config.episodeLabel && (
          <div
            style={{
              position: "absolute",
              top: "30px",
              left: "40px",
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#FFFFFF",
                textAlign: "center",
                lineHeight: 1.1,
              }}
            >
              {config.episodeLabel}
            </span>
          </div>
        )}

        {/* Headline */}
        <h1
          style={{
            fontSize: "54px",
            fontWeight: 900,
            color: "#FFFFFF",
            lineHeight: 1.05,
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
          }}
        >
          {config.headline}
        </h1>

        {/* Subline */}
        {config.subline && (
          <p
            style={{
              fontSize: "24px",
              fontWeight: 500,
              color: "rgba(255,255,255,0.85)",
              marginTop: "20px",
              margin: "20px 0 0 0",
            }}
          >
            {config.subline}
          </p>
        )}

        {/* Diagonal cut */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: "-40px",
            bottom: 0,
            width: "80px",
            backgroundColor: config.accentColor,
            transform: "skewX(-5deg)",
            zIndex: 1,
          }}
        />
      </div>

      {/* Right panel: Photos */}
      <div
        style={{
          flex: "0 0 45%",
          backgroundColor: config.backgroundColor,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "0 20px",
          gap: photoCount > 2 ? "4px" : "8px",
          position: "relative",
        }}
      >
        {photoCount > 0 ? (
          config.photos.map((photo, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: "90%",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
              }}
            >
              <img
                src={photo}
                alt={`Guest ${i + 1}`}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  objectPosition: "bottom center",
                  filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.4))",
                }}
              />
            </div>
          ))
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "18px",
                color: "rgba(255,255,255,0.3)",
                fontStyle: "italic",
              }}
            >
              Photos will appear here
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ThumbnailPreview renders the 1280x720 thumbnail at a scaled size for the UI.
 * The inner ref provides the full-size element for export.
 */
export const ThumbnailPreview = forwardRef<HTMLDivElement, ThumbnailPreviewProps>(
  function ThumbnailPreview({ config, scale = 0.5 }, ref) {
    const Template =
      config.templateId === "split-panel" ? SplitPanelTemplate : BoldBannerTemplate;

    return (
      <div
        style={{
          width: WIDTH * scale,
          height: HEIGHT * scale,
          overflow: "hidden",
          borderRadius: "8px",
          border: "1px solid var(--color-border)",
          backgroundColor: "#000",
        }}
      >
        <div
          ref={ref}
          style={{
            width: WIDTH,
            height: HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <Template config={config} />
        </div>
      </div>
    );
  }
);
