import { create } from "zustand";

interface SettingsState {
  // Output directories
  enhancedVideoDirectory: string;
  extractedAudioDirectory: string;
  showNotesDirectory: string;

  // API keys
  claudeApiKey: string;
  aiEnhancementApiKey: string;
  podbeanClientId: string;
  podbeanClientSecret: string;
  youtubeClientId: string;
  youtubeClientSecret: string;
  youtubeRefreshToken: string;

  // Preferences
  fileNamingTemplate: string;
  autoIncrementEpisode: boolean;
  defaultTags: string[];

  // Legacy alias (maps to extractedAudioDirectory)
  outputDirectory: string;

  // Actions
  setEnhancedVideoDirectory: (dir: string) => void;
  setExtractedAudioDirectory: (dir: string) => void;
  setShowNotesDirectory: (dir: string) => void;
  setOutputDirectory: (dir: string) => void;
  setClaudeApiKey: (key: string) => void;
  setAiEnhancementApiKey: (key: string) => void;
  setPodbeanClientId: (key: string) => void;
  setPodbeanClientSecret: (key: string) => void;
  setYoutubeClientId: (key: string) => void;
  setYoutubeClientSecret: (key: string) => void;
  setYoutubeRefreshToken: (token: string) => void;
  setFileNamingTemplate: (template: string) => void;
  setAutoIncrementEpisode: (auto: boolean) => void;
  setDefaultTags: (tags: string[]) => void;
  loadSettings: (settings: Record<string, string>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  enhancedVideoDirectory: "",
  extractedAudioDirectory: "",
  showNotesDirectory: "",
  claudeApiKey: "",
  aiEnhancementApiKey: "",
  podbeanClientId: "",
  podbeanClientSecret: "",
  youtubeClientId: "",
  youtubeClientSecret: "",
  youtubeRefreshToken: "",
  fileNamingTemplate: "MAM-{episode_number}-{title}",
  autoIncrementEpisode: true,
  defaultTags: [],
  outputDirectory: "", // legacy alias

  setEnhancedVideoDirectory: (dir) => set({ enhancedVideoDirectory: dir }),
  setExtractedAudioDirectory: (dir) =>
    set({ extractedAudioDirectory: dir, outputDirectory: dir }),
  setShowNotesDirectory: (dir) => set({ showNotesDirectory: dir }),
  setOutputDirectory: (dir) =>
    set({ outputDirectory: dir, extractedAudioDirectory: dir }),
  setClaudeApiKey: (key) => set({ claudeApiKey: key }),
  setAiEnhancementApiKey: (key) => set({ aiEnhancementApiKey: key }),
  setPodbeanClientId: (key) => set({ podbeanClientId: key }),
  setPodbeanClientSecret: (key) => set({ podbeanClientSecret: key }),
  setYoutubeClientId: (key) => set({ youtubeClientId: key }),
  setYoutubeClientSecret: (key) => set({ youtubeClientSecret: key }),
  setYoutubeRefreshToken: (token) => set({ youtubeRefreshToken: token }),
  setFileNamingTemplate: (template) => set({ fileNamingTemplate: template }),
  setAutoIncrementEpisode: (auto) => set({ autoIncrementEpisode: auto }),
  setDefaultTags: (tags) => set({ defaultTags: tags }),
  loadSettings: (settings) =>
    set({
      enhancedVideoDirectory: settings.enhancedVideoDirectory || "",
      extractedAudioDirectory:
        settings.extractedAudioDirectory || settings.outputDirectory || "",
      showNotesDirectory: settings.showNotesDirectory || "",
      outputDirectory:
        settings.extractedAudioDirectory || settings.outputDirectory || "",
      claudeApiKey: settings.claudeApiKey || "",
      aiEnhancementApiKey: settings.aiEnhancementApiKey || "",
      podbeanClientId: settings.podbeanClientId || "",
      podbeanClientSecret: settings.podbeanClientSecret || "",
      youtubeClientId: settings.youtubeClientId || "",
      youtubeClientSecret: settings.youtubeClientSecret || "",
      youtubeRefreshToken: settings.youtubeRefreshToken || "",
      fileNamingTemplate:
        settings.fileNamingTemplate || "MAM-{episode_number}-{title}",
      autoIncrementEpisode: settings.autoIncrementEpisode !== "false",
    }),
}));
