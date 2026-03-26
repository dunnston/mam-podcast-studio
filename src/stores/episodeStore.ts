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
  | "thumbnail"
  | "review"
  | "publish";

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

export interface ThumbnailConfig {
  templateId: string;
  headline: string;
  subline: string;
  episodeLabel: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  photos: string[]; // base64 data URLs (background-removed cutouts)
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
  cleanvoiceTranscript: string;

  // Thumbnail state
  thumbnailConfig: ThumbnailConfig | null;
  thumbnailExportedPath: string | null;

  // Processing state
  isProcessing: boolean;
  processingProgress: number;
  processingEta: string;

  // Session tracking — incremented on reset to invalidate in-flight async work
  wizardSessionId: number;

  // Actions
  setCurrentStep: (step: WizardStep) => void;
  setCurrentEpisode: (episode: Episode | null) => void;
  setVideoInfo: (info: VideoInfo | null) => void;
  setEnhancementPreset: (preset: string) => void;
  setSelectedFormats: (formats: string[]) => void;
  setShowNotesContent: (content: string) => void;
  setShowNotesEdited: (content: string) => void;
  setThumbnailConfig: (config: ThumbnailConfig | null) => void;
  setThumbnailExportedPath: (path: string | null) => void;
  setCleanvoiceTranscript: (transcript: string) => void;
  setProcessing: (processing: boolean) => void;
  setProgress: (progress: number, eta?: string) => void;
  resetWizard: () => void;
  loadEpisode: (episode: Episode, showNotes?: string, transcript?: string) => void;
}

const initialState = {
  currentStep: "import" as WizardStep,
  currentEpisode: null,
  videoInfo: null,
  enhancementPreset: "standard",
  selectedFormats: ["mp3", "m4a"],
  showNotesContent: "",
  showNotesEdited: "",
  thumbnailConfig: null as ThumbnailConfig | null,
  thumbnailExportedPath: null as string | null,
  cleanvoiceTranscript: "",
  isProcessing: false,
  processingProgress: 0,
  processingEta: "",
  wizardSessionId: 0,
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
  setThumbnailConfig: (config) => set({ thumbnailConfig: config }),
  setThumbnailExportedPath: (path) => set({ thumbnailExportedPath: path }),
  setCleanvoiceTranscript: (transcript) => set({ cleanvoiceTranscript: transcript }),
  setProcessing: (processing) => set({ isProcessing: processing }),
  setProgress: (progress, eta) =>
    set({ processingProgress: progress, processingEta: eta || "" }),
  resetWizard: () => set((state) => ({ ...initialState, wizardSessionId: state.wizardSessionId + 1 })),
  loadEpisode: (episode, showNotes, transcript) => {
    // Determine which step to resume at based on episode status
    let step: WizardStep = "import";
    if (episode.status === "draft" && episode.original_video_path) {
      step = "enhance";
    }
    if (episode.status === "enhanced" || episode.enhanced_video_path) {
      step = "extract";
    }
    if (episode.status === "extracted") {
      step = "show-notes";
    }
    if (episode.status === "published") {
      step = "publish";
    }

    set({
      currentStep: step,
      currentEpisode: episode,
      videoInfo: episode.original_video_path
        ? {
            // Minimal info for resumed episodes — probe will fill in details
            duration_seconds: 0,
            duration_display: "—",
            video_codec: "—",
            audio_codec: "—",
            resolution: "—",
            file_size_bytes: 0,
            file_size_display: "—",
          }
        : null,
      showNotesContent: showNotes || "",
      showNotesEdited: showNotes || "",
      cleanvoiceTranscript: transcript || "",
      isProcessing: false,
      processingProgress: 0,
      processingEta: "",
    });
  },
}));
