import type { ThumbnailConfig, PhotoPosition } from "../stores/episodeStore";

export interface ThumbnailTemplate {
  id: string;
  name: string;
  description: string;
}

export const TEMPLATES: ThumbnailTemplate[] = [
  {
    id: "bold-banner",
    name: "Bold Banner",
    description: "Full-width colored banner with large headline text and guest cutouts below.",
  },
  {
    id: "split-panel",
    name: "Split Panel",
    description: "Left panel with bold stacked text, right panel with guest cutout photos.",
  },
  {
    id: "youtube-style",
    name: "YouTube Style",
    description: "Background image with styled title bars and draggable guest cutouts.",
  },
];

export function getDefaultPhotoPositions(count: number): PhotoPosition[] {
  const positions: PhotoPosition[] = [];
  for (let i = 0; i < count; i++) {
    const spacing = 300;
    const totalWidth = (count - 1) * spacing;
    const startX = 640 - totalWidth / 2;
    positions.push({
      x: startX + i * spacing,
      y: 400,
      scale: 1.0,
    });
  }
  return positions;
}

export function getDefaultConfig(
  title?: string,
  guestNames?: string[],
  episodeNumber?: number
): ThumbnailConfig {
  // Generate a headline from title - uppercase, truncated
  const headline = title
    ? title.toUpperCase().slice(0, 60)
    : "YOUR HEADLINE HERE";

  const subline = guestNames?.length
    ? `with ${guestNames.join(" & ")}`
    : "";

  const episodeLabel = episodeNumber ? `Ep ${episodeNumber}` : "";

  return {
    templateId: "bold-banner",
    headline,
    subline,
    episodeLabel,
    accentColor: "#C4745A",     // terracotta
    backgroundColor: "#1A1A2E", // dark background
    textColor: "#FFFFFF",
    photos: [],
    title1: {
      text: headline,
      bgColor: "#CC0000",
      textColor: "#FFFFFF",
      borderColor: "#FFFFFF",
      borderWidth: 4,
      fontSize: 48,
    },
    title2: {
      text: subline || "SUBTITLE HERE",
      bgColor: "#2E7D32",
      textColor: "#FFFFFF",
      borderColor: "#FFFFFF",
      borderWidth: 4,
      fontSize: 36,
    },
    photoPositions: [],
  };
}
