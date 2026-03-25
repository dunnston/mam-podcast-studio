import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";

// ─── Video / FFmpeg ─────────────────────────────────────────────

export interface VideoProbeResult {
  duration_seconds: number;
  duration_display: string;
  video_codec: string;
  audio_codec: string;
  resolution: string;
  file_size_bytes: number;
  file_size_display: string;
  bitrate?: number;
}

export interface ProcessingProgress {
  percent: number;
  time_processed: string;
  speed: string;
  eta_seconds?: number;
}

export async function probeVideo(videoPath: string): Promise<VideoProbeResult> {
  return invoke("probe_video", { videoPath });
}

export async function enhanceAudio(
  inputPath: string,
  outputPath: string,
  preset: string,
  totalDuration: number
): Promise<string> {
  return invoke("enhance_audio", {
    inputPath,
    outputPath,
    preset,
    totalDuration,
  });
}

export async function cancelProcessing(): Promise<void> {
  return invoke("cancel_processing");
}

export async function previewEnhancement(
  inputPath: string,
  outputPath: string,
  preset: string,
  startSeconds: number,
  durationSeconds: number
): Promise<string> {
  return invoke("preview_enhancement", {
    inputPath,
    outputPath,
    preset,
    startSeconds,
    durationSeconds,
  });
}

// ─── Extraction ─────────────────────────────────────────────────

export interface ExtractionRequest {
  input_path: string;
  output_dir: string;
  episode_name: string;
  formats: string[];
  total_duration: number;
  title?: string;
  episode_number?: number;
  show_name?: string;
}

export interface ExtractionResult {
  format: string;
  file_path: string;
  file_size_bytes: number;
}

export async function extractAudio(
  request: ExtractionRequest
): Promise<ExtractionResult[]> {
  return invoke("extract_audio", { request });
}

// ─── Show Notes ─────────────────────────────────────────────────

export interface GenerationResult {
  content: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
}

export async function generateShowNotes(
  apiKey: string,
  transcript: string,
  systemPrompt?: string
): Promise<GenerationResult> {
  return invoke("generate_show_notes", { apiKey, transcript, systemPrompt });
}

export async function readTranscript(filePath: string): Promise<string> {
  return invoke("read_transcript", { filePath });
}

// ─── Cleanvoice AI ──────────────────────────────────────────────

export interface CleanvoiceProgress {
  stage: string;    // "extract", "upload", "processing", "download", "mux", "done"
  message: string;
  percent: number;  // 0-100
}

export interface CleanvoiceEnhanceRequest {
  api_key: string;
  input_path: string;
  output_path: string;
  // Audio cleaning (features that CUT content)
  fillers?: boolean;
  long_silences?: boolean;
  mouth_sounds?: boolean;
  breath?: boolean | string;  // true | "legacy" | "natural"
  stutters?: boolean;
  hesitations?: boolean;
  muted?: boolean;            // Silence edits instead of cutting
  // Audio enhancement (no cuts)
  remove_noise?: boolean;
  studio_sound?: boolean | string;  // true | "nightly"
  normalize?: boolean;
  // Output
  export_format?: string;     // "auto" | "mp3" | "wav" | "flac" | "m4a"
  target_lufs?: number;       // -16 is podcast standard
  // Content generation
  transcription?: boolean;
  summarize?: boolean;
}

export interface CleanvoiceAuthInfo {
  email?: string;
  credits?: number;
}

export async function cleanvoiceEnhance(
  request: CleanvoiceEnhanceRequest
): Promise<string> {
  return invoke("cleanvoice_enhance", { request });
}

export async function cleanvoiceCancel(): Promise<void> {
  return invoke("cleanvoice_cancel");
}

export async function testCleanvoiceApi(apiKey: string): Promise<CleanvoiceAuthInfo> {
  return invoke("test_cleanvoice_api", { apiKey });
}

// ─── Podbean ─────────────────────────────────────────────────────

export interface PodbeanProgress {
  stage: string;    // "auth", "upload", "publish", "done"
  message: string;
  percent: number;  // 0-100
}

export interface PodbeanPublishRequest {
  client_id: string;
  client_secret: string;
  audio_path: string;
  title: string;
  content: string;
  status?: string;  // "publish" | "draft" | "future"
}

export interface PodbeanPublishResult {
  episode_id?: string;
  permalink_url?: string;
  media_url?: string;
}

export interface PodbeanTokenInfo {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export async function podbeanPublish(
  request: PodbeanPublishRequest
): Promise<PodbeanPublishResult> {
  return invoke("podbean_publish", { request });
}

export async function testPodbeanApi(
  clientId: string,
  clientSecret: string
): Promise<PodbeanTokenInfo> {
  return invoke("test_podbean_api", { clientId, clientSecret });
}

export async function podbeanListPodcasts(
  clientId: string,
  clientSecret: string
): Promise<unknown[]> {
  return invoke("podbean_list_podcasts", { clientId, clientSecret });
}

export function onPodbeanProgress(
  callback: (progress: PodbeanProgress) => void
): Promise<UnlistenFn> {
  return listen<PodbeanProgress>("podbean-progress", (event) => {
    callback(event.payload);
  });
}

// ─── YouTube ─────────────────────────────────────────────────────

export interface YouTubeProgress {
  stage: string;    // "auth", "upload", "thumbnail", "done"
  message: string;
  percent: number;  // 0-100
}

export interface YouTubeTokenInfo {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface YouTubeUploadRequest {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  video_path: string;
  title: string;
  description: string;
  tags?: string[];
  privacy_status?: string;  // "public" | "private" | "unlisted"
  category_id?: string;
  thumbnail_path?: string;
}

export interface YouTubeUploadResult {
  video_id?: string;
  channel_id?: string;
  upload_status?: string;
}

export async function youtubeOAuthStart(
  clientId: string,
  clientSecret: string
): Promise<YouTubeTokenInfo> {
  return invoke("youtube_oauth_start", { clientId, clientSecret });
}

export async function youtubeRefreshToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<YouTubeTokenInfo> {
  return invoke("youtube_refresh_token", { clientId, clientSecret, refreshToken });
}

export async function youtubeUpload(
  request: YouTubeUploadRequest
): Promise<YouTubeUploadResult> {
  return invoke("youtube_upload", { request });
}

export function onYouTubeProgress(
  callback: (progress: YouTubeProgress) => void
): Promise<UnlistenFn> {
  return listen<YouTubeProgress>("youtube-progress", (event) => {
    callback(event.payload);
  });
}

// ─── Settings ───────────────────────────────────────────────────

export async function testClaudeApi(apiKey: string): Promise<boolean> {
  return invoke("test_claude_api", { apiKey });
}

// ─── Events ─────────────────────────────────────────────────────

export function onEnhancementProgress(
  callback: (progress: ProcessingProgress) => void
): Promise<UnlistenFn> {
  return listen<ProcessingProgress>("enhancement-progress", (event) => {
    callback(event.payload);
  });
}

export function onCleanvoiceProgress(
  callback: (progress: CleanvoiceProgress) => void
): Promise<UnlistenFn> {
  return listen<CleanvoiceProgress>("cleanvoice-progress", (event) => {
    callback(event.payload);
  });
}

export function onCleanvoiceTranscript(
  callback: (transcript: string) => void
): Promise<UnlistenFn> {
  return listen<string>("cleanvoice-transcript", (event) => {
    callback(event.payload);
  });
}

export function onExtractionProgress(
  callback: (data: { format: string; status: string }) => void
): Promise<UnlistenFn> {
  return listen("extraction-progress", (event) => {
    callback(event.payload as { format: string; status: string });
  });
}

// ─── File Dialogs ───────────────────────────────────────────────

export async function openVideoFile(): Promise<string | null> {
  const result = await open({
    multiple: false,
    filters: [
      {
        name: "Video",
        extensions: ["mp4", "mov", "mkv", "avi"],
      },
    ],
  });
  return result as string | null;
}

export async function openTranscriptFile(): Promise<string | null> {
  const result = await open({
    multiple: false,
    filters: [
      {
        name: "Transcript",
        extensions: ["txt", "docx", "pdf", "md"],
      },
    ],
  });
  return result as string | null;
}

export async function selectOutputDirectory(): Promise<string | null> {
  const result = await open({
    directory: true,
  });
  return result as string | null;
}

export async function saveFile(
  defaultName: string,
  extensions: string[]
): Promise<string | null> {
  const result = await save({
    defaultPath: defaultName,
    filters: [{ name: "File", extensions }],
  });
  return result;
}
