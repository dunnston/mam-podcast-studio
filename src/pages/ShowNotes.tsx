import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UploadCloud,
  FileText,
  Sparkles,
  Copy,
  Download,
  CheckCircle2,
  DollarSign,
  Hash,
  Trash2,
  Plus,
  ChevronDown,
  Clock,
} from "lucide-react";
import {
  generateShowNotes,
  readTranscript,
  openTranscriptFile,
} from "../lib/tauri";
import {
  saveShowNotes,
  listAllShowNotes,
  updateShowNoteContent,
  deleteShowNote,
} from "../lib/database";
import type { GenerationResult } from "../lib/tauri";
import type { ShowNoteRow } from "../lib/database";
import { useSettingsStore } from "../stores/settingsStore";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

const DEFAULT_SYSTEM_PROMPT = `You are a show notes writer for the Modern Ancestral Mamas podcast — a show about ancestral health, holistic wellness, and intentional motherhood hosted by Corey and Christine.

Given a transcript of a podcast episode, generate show notes in plain text (NOT markdown) following this exact structure and tone. Use the actual episode content to fill in each section. The tone should be warm, grounded, informative, and empathetic — never salesy or clickbaity.

=== FORMAT ===

[Start with a thought-provoking hook question — a "What if..." or "What happens when..." style question that captures the core tension or theme of the episode. This should be 1-2 sentences that draw the reader in.]

If the episode features a guest:
"In this episode, Corey and Christine sit down with [Guest Full Name] [of/from Organization if applicable] to [describe the core conversation topic in 1-2 sentences]. [Continue with 2-3 more sentences expanding on what makes this conversation important and what ground they cover.]"

If it is a solo or co-host-only episode (no guest):
"In this episode, Corey and Christine [dive into / explore / unpack / talk about] [describe the core conversation topic in 1-2 sentences]. [Continue with 2-3 more sentences expanding on what makes this conversation important and what ground they cover.]"

Join our Patreon community for ad-free episodes, early access, and bonus conversations with guests.
https://www.patreon.com/c/ModernAncestralMamas

[Write 1-2 additional paragraphs that go deeper into the specific topics discussed. If there is a guest, reference specific things they share — their personal story, their expertise, the practical insights they offer. For solo episodes, expand on the key ideas Corey and Christine explore. End this section by describing who this conversation will resonate with or what listeners will take away. Use plain language, not jargon.]

📚 Topics Covered in This Episode:
✔️ [Topic 1 — be specific and descriptive, not generic]
✔️ [Topic 2]
✔️ [Topic 3]
✔️ [Topic 4]
✔️ [Topic 5]
✔️ [Topic 6]
✔️ [Topic 7]
✔️ [Topic 8]
✔️ [Topic 9]
✔️ [Topic 10]

🧠 More About This Episode:
If the episode features a guest:
"[Guest Full Name] is [their credentials, role, and what they're known for — 2-3 sentences based on how they are introduced in the episode]. [1 sentence about their approach or mission.]"
If it is a solo or co-host-only episode, skip the guest bio and write a brief paragraph about the episode's themes and why they matter.

[1-2 sentences describing who this episode is especially for and what it offers them. End with something grounding or hopeful.]

If the guest's website or URL is mentioned in the episode, include: "Find [Guest First Name] here: [URL]"
If no URL is mentioned, omit this line entirely.

✨ Support the Show!
👍 Like & Subscribe for more ancestral motherhood conversations
⭐ Leave a 5-star review on Apple Podcasts or Spotify
💬 Comment below: [Write a relevant, open-ended question related to the episode topic that invites audience engagement]

[Generate approximately 10 hashtags. Always include #ModernAncestralMamas. The rest should be relevant to the specific episode topic. Format: #HashtagOne #HashtagTwo etc.]

📲 Stay Connected: Patreon Community | https://www.patreon.com/c/ModernAncestralMamas
@fornutrientssake | https://www.instagram.com/fornutrientssake/
@nourishthelittles | https://www.instagram.com/nourishthelittles/
@modernancestralmamas | https://www.instagram.com/modernancestralmamas/
YouTube | https://www.youtube.com/@ModernAncestralMamas

=== RULES ===
- Output plain text only. Do NOT use markdown headers (##), bold (**), or other markdown formatting.
- Do NOT include timestamps — this podcast does not use them in show notes.
- Do NOT include a "Notable Quotes" section.
- Do NOT include an "Actionable Takeaways" section.
- Do NOT include a "Resources Mentioned" section as a separate heading — weave any key resources into the body paragraphs or guest bio naturally.
- The 📚 Topics section should have exactly 10 items. Each should be a specific, descriptive statement — not a vague category.
- The Patreon plug, Support section, hashtags, and Stay Connected footer must appear in every set of show notes exactly as shown above.
- If the guest mentions books, use the format: 📍 [Book Title] by [Author] and list them before the Topics section only if books are a significant part of the conversation.
- Match the warm, grounded, empathetic tone of the podcast. Write as if speaking to an engaged community of mothers who value ancestral wisdom and holistic health.`;

function estimateCost(charCount: number): { tokens: number; cost: string } {
  const tokens = Math.ceil(charCount / 4);
  const inputCost = (tokens / 1_000_000) * 0.25;
  const outputCost = (1200 / 1_000_000) * 1.25;
  const total = inputCost + outputCost;
  return { tokens, cost: `~$${total.toFixed(4)}` };
}

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(dateStr + "Z"));
  } catch {
    return dateStr;
  }
}

type View = "list" | "create" | "edit";

export function ShowNotes() {
  const queryClient = useQueryClient();
  const { claudeApiKey } = useSettingsStore();

  // View state
  const [view, setView] = useState<View>("list");
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);

  // Create/edit state
  const [title, setTitle] = useState("");
  const [transcriptPath, setTranscriptPath] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState("");
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Fetch all show notes
  const { data: showNotes = [], isLoading } = useQuery({
    queryKey: ["showNotes"],
    queryFn: listAllShowNotes,
  });

  const estimate = transcriptText ? estimateCost(transcriptText.length) : null;

  const resetCreateState = () => {
    setTitle("");
    setTranscriptPath(null);
    setTranscriptText("");
    setGenerationResult(null);
    setEditedContent("");
    setError(null);
    setActiveNoteId(null);
  };

  const handleNewNote = () => {
    resetCreateState();
    setView("create");
  };

  const handleOpenNote = (note: ShowNoteRow & { episode_title?: string }) => {
    setActiveNoteId(note.id);
    setTitle(note.title || note.episode_title || "");
    setEditedContent(note.edited_content || note.generated_content || "");
    setTranscriptPath(note.transcript_path);
    setTranscriptText("");
    setGenerationResult(null);
    setError(null);
    setView("edit");
  };

  const handleBrowseTranscript = async () => {
    const path = await openTranscriptFile();
    if (!path) return;
    setIsLoadingTranscript(true);
    setError(null);
    try {
      const text = await readTranscript(path);
      setTranscriptPath(path);
      setTranscriptText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read transcript.");
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["txt", "md", "docx", "pdf"].includes(ext)) {
      setError("Unsupported file type. Please use TXT, DOCX, PDF, or MD.");
      return;
    }

    setIsLoadingTranscript(true);
    setError(null);
    try {
      const text = await file.text();
      setTranscriptPath(file.name);
      setTranscriptText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read dropped file.");
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  const handleGenerate = async () => {
    if (!transcriptText || !claudeApiKey) return;

    setIsGenerating(true);
    setError(null);
    setGenerationResult(null);

    let result: GenerationResult;
    try {
      result = await generateShowNotes(
        claudeApiKey,
        transcriptText,
        DEFAULT_SYSTEM_PROMPT
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
      setIsGenerating(false);
      return;
    }

    setGenerationResult(result);
    setEditedContent(result.content);
    setIsGenerating(false);

    // Save to database (separate from generation so a DB error doesn't mask success)
    try {
      const noteId = await saveShowNotes({
        title: title || "Untitled Show Notes",
        transcript_path: transcriptPath || undefined,
        generated_content: result.content,
        tokens_used: result.input_tokens + result.output_tokens,
      });
      setActiveNoteId(noteId);
      queryClient.invalidateQueries({ queryKey: ["showNotes"] });
      setView("edit");
    } catch (err) {
      console.error("Failed to save show notes to DB:", err);
      setError("Show notes were generated but failed to save. You can copy the content above.");
    }
  };

  const handleRegenerate = async () => {
    if (!transcriptText || !claudeApiKey || !activeNoteId) return;

    setIsGenerating(true);
    setError(null);

    let result: GenerationResult;
    try {
      result = await generateShowNotes(
        claudeApiKey,
        transcriptText,
        DEFAULT_SYSTEM_PROMPT
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
      setIsGenerating(false);
      return;
    }

    setGenerationResult(result);
    setEditedContent(result.content);
    setIsGenerating(false);

    try {
      await updateShowNoteContent(activeNoteId, result.content);
      queryClient.invalidateQueries({ queryKey: ["showNotes"] });
    } catch (err) {
      console.error("Failed to save regenerated show notes:", err);
      setError("Show notes were regenerated but failed to save. You can copy the content above.");
    }
  };

  const handleSaveEdit = async () => {
    if (!activeNoteId || !editedContent) return;
    try {
      await updateShowNoteContent(activeNoteId, editedContent);
      queryClient.invalidateQueries({ queryKey: ["showNotes"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteShowNote(id);
      queryClient.invalidateQueries({ queryKey: ["showNotes"] });
      if (activeNoteId === id) {
        resetCreateState();
        setView("list");
      }
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (format: "txt" | "md" | "html") => {
    let exportContent = editedContent;
    let mimeType = "text/plain";
    let extension = "txt";

    if (format === "md") {
      mimeType = "text/markdown";
      extension = "md";
    } else if (format === "html") {
      exportContent = `<!DOCTYPE html>\n<html>\n<body>\n<pre>${editedContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>\n</body>\n</html>`;
      mimeType = "text/html";
      extension = "html";
    }

    const blob = new Blob([exportContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "show-notes").replace(/[^a-zA-Z0-9-_ ]/g, "")}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── List View ──────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div style={{ padding: "40px 48px", maxWidth: "960px", margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "32px",
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "28px",
                fontWeight: "600",
                color: "var(--color-cream)",
                marginBottom: "6px",
              }}
            >
              Show Notes
            </h1>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                color: "var(--color-text-muted)",
              }}
            >
              Generate and manage show notes from transcripts
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            icon={<Plus size={16} />}
            onClick={handleNewNote}
          >
            New Show Notes
          </Button>
        </div>

        {/* Show notes list */}
        {isLoading ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--color-text-muted)",
            }}
          >
            Loading...
          </div>
        ) : showNotes.length === 0 ? (
          <Card>
            <div
              style={{
                padding: "48px 24px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <FileText size={40} style={{ color: "var(--color-text-muted)", opacity: 0.4 }} />
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "16px",
                    fontWeight: "500",
                    color: "var(--color-cream)",
                    marginBottom: "6px",
                  }}
                >
                  No show notes yet
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "13px",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Upload a transcript and generate your first show notes
                </p>
              </div>
              <Button
                variant="primary"
                icon={<Plus size={14} />}
                onClick={handleNewNote}
              >
                Create Show Notes
              </Button>
            </div>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {showNotes.map((note: ShowNoteRow & { episode_title?: string }) => (
              <button
                key={note.id}
                onClick={() => handleOpenNote(note)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  padding: "16px 20px",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "10px",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "border-color 150ms ease, background-color 150ms ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-sage-dark)";
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-surface-light)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)";
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-surface)";
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(122, 139, 111, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <FileText size={16} style={{ color: "var(--color-sage)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "var(--color-cream)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {note.title || note.episode_title || "Untitled Show Notes"}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "2px" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "11px",
                        color: "var(--color-text-muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Clock size={10} />
                      {formatDate(note.updated_at || note.created_at)}
                    </span>
                    {note.episode_id && (
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: "600",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: "rgba(122, 139, 111, 0.15)",
                          color: "var(--color-sage)",
                        }}
                      >
                        Episode
                      </span>
                    )}
                    {note.tokens_used && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {note.tokens_used.toLocaleString()} tokens
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  {deleteConfirmId === note.id ? (
                    <>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(note.id);
                        }}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(note.id);
                      }}
                      title="Delete"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "6px",
                        borderRadius: "6px",
                        color: "var(--color-text-muted)",
                        transition: "color 150ms ease",
                        display: "flex",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = "#E57373";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <ChevronDown
                    size={14}
                    style={{ color: "var(--color-text-muted)", transform: "rotate(-90deg)" }}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Create View ────────────────────────────────────────────────
  if (view === "create") {
    return (
      <div style={{ padding: "40px 48px", maxWidth: "960px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <button
            onClick={() => { resetCreateState(); setView("list"); }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              color: "var(--color-sage)",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <ChevronDown size={14} style={{ transform: "rotate(90deg)" }} />
            Back to Show Notes
          </button>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "28px",
              fontWeight: "600",
              color: "var(--color-cream)",
              marginBottom: "6px",
            }}
          >
            New Show Notes
          </h1>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--color-text-muted)",
            }}
          >
            Upload a transcript and generate show notes with AI
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Title */}
          <div>
            <label
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                fontWeight: "600",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
                display: "block",
                marginBottom: "8px",
              }}
            >
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Episode 42 — Gut Health Deep Dive"
              style={{
                width: "100%",
                padding: "12px 16px",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                color: "var(--color-cream)",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                outline: "none",
                transition: "border-color 150ms ease",
              }}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--color-sage)"; }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "var(--color-border)"; }}
            />
          </div>

          {/* Transcript upload */}
          <div>
            <label
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                fontWeight: "600",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
                display: "block",
                marginBottom: "8px",
              }}
            >
              Transcript
            </label>
            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => {
                if (!dropRef.current?.contains(e.relatedTarget as Node)) {
                  setIsDragging(false);
                }
              }}
              onClick={!transcriptPath ? handleBrowseTranscript : undefined}
              style={{
                border: `2px dashed ${isDragging ? "var(--color-sage)" : transcriptPath ? "var(--color-sage-dark)" : "var(--color-border)"}`,
                borderRadius: "12px",
                padding: "32px 24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                cursor: transcriptPath ? "default" : "pointer",
                backgroundColor: isDragging
                  ? "rgba(122, 139, 111, 0.06)"
                  : "var(--color-surface)",
                transition: "border-color 150ms ease, background-color 150ms ease",
              }}
            >
              {isLoadingTranscript ? (
                <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--color-text-muted)" }}>
                  Reading transcript...
                </p>
              ) : transcriptPath ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
                  <FileText size={20} style={{ color: "var(--color-sage)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: "500", color: "var(--color-cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {transcriptPath.split(/[\\/]/).pop()}
                    </p>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-text-muted)" }}>
                      {transcriptText.length.toLocaleString()} characters
                    </p>
                  </div>
                  <button
                    onClick={handleBrowseTranscript}
                    style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-sage)", textDecoration: "underline", flexShrink: 0 }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <UploadCloud size={24} style={{ color: isDragging ? "var(--color-sage)" : "var(--color-text-muted)" }} />
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: "500", color: "var(--color-cream)", marginBottom: "4px" }}>
                      Drop your transcript here
                    </p>
                    <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-text-muted)" }}>
                      or <span style={{ color: "var(--color-sage)", textDecoration: "underline" }}>click to browse</span> — TXT, DOCX, PDF, MD
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Transcript preview */}
            {transcriptText && (
              <Card
                padding="none"
                style={{ marginTop: "12px", maxHeight: "160px", overflow: "hidden", position: "relative" }}
              >
                <div
                  style={{
                    padding: "16px",
                    maxHeight: "160px",
                    overflowY: "auto",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: "var(--color-text-muted)",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {transcriptText.slice(0, 500)}
                  {transcriptText.length > 500 && (
                    <span style={{ color: "var(--color-border)" }}>
                      {"\n"}...{" "}
                      <span style={{ color: "var(--color-text-muted)" }}>
                        ({(transcriptText.length - 500).toLocaleString()} more characters)
                      </span>
                    </span>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* API key warning */}
          {!claudeApiKey && (
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "rgba(196, 116, 90, 0.1)",
                border: "1px solid rgba(196, 116, 90, 0.25)",
                borderRadius: "8px",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                color: "var(--color-terracotta-light)",
              }}
            >
              No Claude API key configured. Add one in{" "}
              <span style={{ textDecoration: "underline" }}>Settings → API Keys</span>{" "}
              to generate show notes.
            </div>
          )}

          {/* Generation controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            {estimate && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  padding: "10px 14px",
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  flex: 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Hash size={13} style={{ color: "var(--color-text-muted)" }} />
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-text-muted)" }}>
                    Est. tokens:{" "}
                    <span style={{ color: "var(--color-cream)", fontFamily: "var(--font-mono)" }}>
                      {estimate.tokens.toLocaleString()}
                    </span>
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <DollarSign size={13} style={{ color: "var(--color-text-muted)" }} />
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-text-muted)" }}>
                    Est. cost:{" "}
                    <span style={{ color: "var(--color-cream)", fontFamily: "var(--font-mono)" }}>
                      {estimate.cost}
                    </span>
                  </span>
                </div>
              </div>
            )}
            <Button
              variant="primary"
              size="lg"
              icon={isGenerating ? undefined : <Sparkles size={16} />}
              loading={isGenerating}
              onClick={handleGenerate}
              disabled={!transcriptText || !claudeApiKey}
            >
              {isGenerating ? "Generating..." : "Generate Show Notes"}
            </Button>
          </div>

          {/* Generation result */}
          {generationResult && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                padding: "10px 16px",
                backgroundColor: "rgba(122, 139, 111, 0.08)",
                border: "1px solid rgba(122, 139, 111, 0.2)",
                borderRadius: "8px",
              }}
            >
              <CheckCircle2 size={15} style={{ color: "var(--color-sage)" }} />
              <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--color-text-muted)" }}>
                Generated successfully —
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-sage)" }}>
                {generationResult.input_tokens.toLocaleString()} in
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-text-muted)" }}>+</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-sage)" }}>
                {generationResult.output_tokens.toLocaleString()} out tokens
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-terracotta)" }}>
                ${generationResult.estimated_cost.toFixed(4)}
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "rgba(192, 57, 43, 0.12)",
                border: "1px solid rgba(192, 57, 43, 0.25)",
                borderRadius: "8px",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                color: "#E57373",
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Edit View ──────────────────────────────────────────────────
  return (
    <div style={{ padding: "40px 48px", maxWidth: "960px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <button
          onClick={() => { resetCreateState(); setView("list"); }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--color-sage)",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <ChevronDown size={14} style={{ transform: "rotate(90deg)" }} />
          Back to Show Notes
        </button>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "24px",
            fontWeight: "600",
            color: "var(--color-cream)",
            marginBottom: "6px",
          }}
        >
          {title || "Untitled Show Notes"}
        </h1>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            variant="ghost"
            size="sm"
            icon={copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            onClick={handleCopy}
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button variant="ghost" size="sm" icon={<Download size={13} />} onClick={() => handleExport("txt")}>
            .txt
          </Button>
          <Button variant="ghost" size="sm" icon={<Download size={13} />} onClick={() => handleExport("md")}>
            .md
          </Button>
          <Button variant="ghost" size="sm" icon={<Download size={13} />} onClick={() => handleExport("html")}>
            .html
          </Button>
        </div>
        <Button variant="primary" size="sm" onClick={handleSaveEdit}>
          Save Changes
        </Button>
      </div>

      {/* Editor */}
      <textarea
        value={editedContent}
        onChange={(e) => setEditedContent(e.target.value)}
        spellCheck
        style={{
          width: "100%",
          minHeight: "500px",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          lineHeight: "1.7",
          color: "var(--color-cream)",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "10px",
          padding: "20px",
          outline: "none",
          resize: "vertical",
          transition: "border-color 150ms ease",
        }}
        onFocus={(e) => {
          (e.target as HTMLTextAreaElement).style.borderColor = "var(--color-sage)";
        }}
        onBlur={(e) => {
          (e.target as HTMLTextAreaElement).style.borderColor = "var(--color-border)";
        }}
      />
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "11px",
          color: "var(--color-text-muted)",
          marginTop: "6px",
        }}
      >
        {editedContent
          .trim()
          .split(/\s+/)
          .filter(Boolean).length.toLocaleString()}{" "}
        words
      </p>

      {/* Re-generate from transcript section */}
      <div style={{ marginTop: "24px" }}>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "11px",
            fontWeight: "600",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            marginBottom: "8px",
          }}
        >
          Regenerate
        </p>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "12px" }}>
          Upload a transcript to regenerate these show notes with AI.
        </p>
        {transcriptText ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
              <FileText size={14} style={{ color: "var(--color-sage)", flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {transcriptPath?.split(/[\\/]/).pop() || "Transcript"}
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-text-muted)" }}>
                ({transcriptText.length.toLocaleString()} chars)
              </span>
              <button
                onClick={() => { setTranscriptText(""); setTranscriptPath(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-sage)", textDecoration: "underline" }}
              >
                Change
              </button>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={isGenerating ? undefined : <Sparkles size={13} />}
              loading={isGenerating}
              onClick={handleRegenerate}
              disabled={!claudeApiKey}
            >
              {isGenerating ? "Generating..." : "Regenerate"}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" icon={<UploadCloud size={13} />} onClick={handleBrowseTranscript}>
            Upload Transcript
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px 16px",
            backgroundColor: "rgba(192, 57, 43, 0.12)",
            border: "1px solid rgba(192, 57, 43, 0.25)",
            borderRadius: "8px",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "#E57373",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
