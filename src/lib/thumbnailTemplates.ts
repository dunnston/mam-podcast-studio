import type { ThumbnailConfig } from "../stores/episodeStore";

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
];

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
  };
}
