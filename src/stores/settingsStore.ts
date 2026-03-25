import { create } from "zustand";

interface SettingsState {
  outputDirectory: string;
  claudeApiKey: string;
  aiEnhancementApiKey: string;
  fileNamingTemplate: string;
  autoIncrementEpisode: boolean;
  defaultTags: string[];

  setOutputDirectory: (dir: string) => void;
  setClaudeApiKey: (key: string) => void;
  setAiEnhancementApiKey: (key: string) => void;
  setFileNamingTemplate: (template: string) => void;
  setAutoIncrementEpisode: (auto: boolean) => void;
  setDefaultTags: (tags: string[]) => void;
  loadSettings: (settings: Record<string, string>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  outputDirectory: "",
  claudeApiKey: "",
  aiEnhancementApiKey: "",
  fileNamingTemplate: "MAM-{episode_number}-{title}",
  autoIncrementEpisode: true,
  defaultTags: [],

  setOutputDirectory: (dir) => set({ outputDirectory: dir }),
  setClaudeApiKey: (key) => set({ claudeApiKey: key }),
  setAiEnhancementApiKey: (key) => set({ aiEnhancementApiKey: key }),
  setFileNamingTemplate: (template) => set({ fileNamingTemplate: template }),
  setAutoIncrementEpisode: (auto) => set({ autoIncrementEpisode: auto }),
  setDefaultTags: (tags) => set({ defaultTags: tags }),
  loadSettings: (settings) =>
    set({
      outputDirectory: settings.outputDirectory || "",
      claudeApiKey: settings.claudeApiKey || "",
      aiEnhancementApiKey: settings.aiEnhancementApiKey || "",
      fileNamingTemplate:
        settings.fileNamingTemplate || "MAM-{episode_number}-{title}",
      autoIncrementEpisode: settings.autoIncrementEpisode !== "false",
    }),
}));
