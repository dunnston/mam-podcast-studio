import { create } from "zustand";

export type EpisodeStatus =
  | "draft"
  | "processing"
  | "enhanced"
  | "extracted"
  | "published";

export type WizardStep =
  | "import"
  | "enhance"
  | "extract"
  | "show-notes"
  | "review";

export interface Episode {
  id?: number;
  episode_number?: number;
  title: string;
  recording_date?: string;
  guest_names?: string[];
  tags?: string[];
  original_video_path?: string;
  enhanced_video_path?: string;
  status: EpisodeStatus;
  created_at?: string;
  updated_at?: string;
}

export interface VideoInfo {
  duration_seconds: number;
  duration_display: string;
  video_codec: string;
  audio_codec: string;
  resolution: string;
  file_size_bytes: number;
  file_size_display: string;
  bitrate?: number;
}

interface EpisodeState {
  // Current wizard state
  currentStep: WizardStep;
  currentEpisode: Episode | null;
  videoInfo: VideoInfo | null;
  enhancementPreset: string;
  selectedFormats: string[];
  showNotesContent: string;
  showNotesEdited: string;

  // Processing state
  isProcessing: boolean;
  processingProgress: number;
  processingEta: string;

  // Actions
  setCurrentStep: (step: WizardStep) => void;
  setCurrentEpisode: (episode: Episode | null) => void;
  setVideoInfo: (info: VideoInfo | null) => void;
  setEnhancementPreset: (preset: string) => void;
  setSelectedFormats: (formats: string[]) => void;
  setShowNotesContent: (content: string) => void;
  setShowNotesEdited: (content: string) => void;
  setProcessing: (processing: boolean) => void;
  setProgress: (progress: number, eta?: string) => void;
  resetWizard: () => void;
}

const initialState = {
  currentStep: "import" as WizardStep,
  currentEpisode: null,
  videoInfo: null,
  enhancementPreset: "standard",
  selectedFormats: ["mp3", "m4a"],
  showNotesContent: "",
  showNotesEdited: "",
  isProcessing: false,
  processingProgress: 0,
  processingEta: "",
};

export const useEpisodeStore = create<EpisodeState>((set) => ({
  ...initialState,

  setCurrentStep: (step) => set({ currentStep: step }),
  setCurrentEpisode: (episode) => set({ currentEpisode: episode }),
  setVideoInfo: (info) => set({ videoInfo: info }),
  setEnhancementPreset: (preset) => set({ enhancementPreset: preset }),
  setSelectedFormats: (formats) => set({ selectedFormats: formats }),
  setShowNotesContent: (content) => set({ showNotesContent: content }),
  setShowNotesEdited: (content) => set({ showNotesEdited: content }),
  setProcessing: (processing) => set({ isProcessing: processing }),
  setProgress: (progress, eta) =>
    set({ processingProgress: progress, processingEta: eta || "" }),
  resetWizard: () => set(initialState),
}));
