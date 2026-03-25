import { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  Sparkles,
  Copy,
  Download,
  CheckCircle2,
  DollarSign,
  Hash,
  ArrowRight,
  Mic,
} from "lucide-react";
import { useEpisodeStore } from "../../stores/episodeStore";
import {
  generateShowNotes,
  readTranscript,
  openTranscriptFile,
} from "../../lib/tauri";
import { saveShowNotes } from "../../lib/database";
import type { GenerationResult } from "../../lib/tauri";
import { useSettingsStore } from "../../stores/settingsStore";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

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
  // Rough estimate: ~4 chars per token for Claude
  const tokens = Math.ceil(charCount / 4);
  // Claude 3 Haiku: ~$0.25/1M input tokens + ~$1.25/1M output tokens
  const inputCost = (tokens / 1_000_000) * 0.25;
  const outputCost = (1200 / 1_000_000) * 1.25; // estimate 1200 output tokens
  const total = inputCost + outputCost;
  return { tokens, cost: `~$${total.toFixed(4)}` };
}

export function ShowNotesStep() {
  const {
    currentEpisode,
    showNotesContent,
    showNotesEdited,
    cleanvoiceTranscript,
    setShowNotesContent,
    setShowNotesEdited,
    setCurrentStep,
    wizardSessionId,
  } = useEpisodeStore();

  const { claudeApiKey } = useSettingsStore();
  const [transcriptSource, setTranscriptSource] = useState<"none" | "cleanvoice" | "file">("none");
  const [transcriptPath, setTranscriptPath] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);

  // Auto-populate with Cleanvoice transcript if available on mount
  const hasCleanvoiceTranscript = Boolean(cleanvoiceTranscript);
  const initializedRef = useRef(false);
  if (!initializedRef.current && cleanvoiceTranscript) {
    initializedRef.current = true;
    setTranscriptText(cleanvoiceTranscript);
    setTranscriptSource("cleanvoice");
  }
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const estimate = transcriptText ? estimateCost(transcriptText.length) : null;

  const handleBrowseTranscript = async () => {
    const path = await openTranscriptFile();
    if (!path) return;
    setIsLoadingTranscript(true);
    setError(null);
    try {
      const text = await readTranscript(path);
      setTranscriptPath(path);
      setTranscriptText(text);
      setTranscriptSource("file");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read transcript.");
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  const handleUseCleanvoiceTranscript = () => {
    setTranscriptText(cleanvoiceTranscript);
    setTranscriptPath(null);
    setTranscriptSource("cleanvoice");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleBrowseTranscript();
  };

  const handleGenerate = async () => {
    if (!transcriptText || !claudeApiKey) return;

    const sessionId = wizardSessionId;
    const isStale = () => useEpisodeStore.getState().wizardSessionId !== sessionId;

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateShowNotes(
        claudeApiKey,
        transcriptText,
        DEFAULT_SYSTEM_PROMPT
      );

      if (isStale()) return;

      setGenerationResult(result);
      setShowNotesContent(result.content);
      setShowNotesEdited(result.content);

      // Save to database
      if (currentEpisode?.id) {
        try {
          await saveShowNotes({
            episode_id: currentEpisode.id,
            transcript_path: transcriptPath || undefined,
            generated_content: result.content,
            tokens_used: result.input_tokens + result.output_tokens,
          });
        } catch (e) {
          console.error("Failed to save show notes to DB:", e);
        }
      }
    } catch (err) {
      if (!isStale()) {
        setError(err instanceof Error ? err.message : "Generation failed.");
      }
    } finally {
      if (!isStale()) {
        setIsGenerating(false);
      }
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(showNotesEdited || showNotesContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (format: "txt" | "md" | "html") => {
    const content = showNotesEdited || showNotesContent;
    let exportContent = content;
    let mimeType = "text/plain";
    let extension = "txt";

    if (format === "md") {
      mimeType = "text/markdown";
      extension = "md";
    } else if (format === "html") {
      // Very basic markdown-to-html
      exportContent = `<!DOCTYPE html>\n<html>\n<body>\n<pre>${content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>\n</body>\n</html>`;
      mimeType = "text/html";
      extension = "html";
    }

    const blob = new Blob([exportContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `show-notes.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasContent = Boolean(showNotesEdited || showNotesContent);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Transcript source */}
      <div>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "11px",
            fontWeight: "600",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            marginBottom: "12px",
          }}
        >
          Transcript
        </p>

        {/* Cleanvoice transcript available */}
        {hasCleanvoiceTranscript && transcriptSource === "cleanvoice" && (
          <div
            style={{
              border: "2px solid var(--color-sage-dark)",
              borderRadius: "12px",
              padding: "18px 20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              backgroundColor: "rgba(122, 139, 111, 0.06)",
            }}
          >
            <Mic size={20} style={{ color: "var(--color-sage)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", fontWeight: "500", color: "var(--color-cream)", marginBottom: "2px" }}>
                Cleanvoice AI Transcript
              </p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-text-muted)" }}>
                {cleanvoiceTranscript.length.toLocaleString()} characters — auto-generated during enhancement
              </p>
            </div>
            <button
              onClick={handleBrowseTranscript}
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--color-sage)", textDecoration: "underline", flexShrink: 0 }}
            >
              Upload different
            </button>
          </div>
        )}

        {/* File upload (shown when no Cleanvoice transcript, or user chose file source) */}
        {(transcriptSource === "file" || !hasCleanvoiceTranscript) && (
          <>
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

            {/* Option to switch back to Cleanvoice transcript */}
            {hasCleanvoiceTranscript && transcriptSource === "file" && (
              <button
                onClick={handleUseCleanvoiceTranscript}
                style={{
                  marginTop: "8px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  color: "var(--color-sage)",
                  textDecoration: "underline",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Mic size={12} />
                Use Cleanvoice transcript instead
              </button>
            )}
          </>
        )}

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

      {/* Actual cost after generation */}
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

      {/* Editor */}
      {hasContent && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                fontWeight: "600",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
              }}
            >
              Show Notes
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button
                variant="ghost"
                size="sm"
                icon={copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                onClick={handleCopy}
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Download size={13} />}
                onClick={() => handleExport("txt")}
              >
                .txt
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Download size={13} />}
                onClick={() => handleExport("md")}
              >
                .md
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Download size={13} />}
                onClick={() => handleExport("html")}
              >
                .html
              </Button>
            </div>
          </div>
          <textarea
            value={showNotesEdited || showNotesContent}
            onChange={(e) => setShowNotesEdited(e.target.value)}
            spellCheck
            style={{
              width: "100%",
              minHeight: "400px",
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
              (e.target as HTMLTextAreaElement).style.borderColor =
                "var(--color-sage)";
            }}
            onBlur={(e) => {
              (e.target as HTMLTextAreaElement).style.borderColor =
                "var(--color-border)";
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
            {(showNotesEdited || showNotesContent)
              .trim()
              .split(/\s+/)
              .filter(Boolean).length.toLocaleString()}{" "}
            words
          </p>
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={() => setCurrentStep("review")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--color-text-muted)",
            textDecoration: "underline",
          }}
        >
          Skip show notes
        </button>
        <Button
          variant="primary"
          size="lg"
          icon={<ArrowRight size={16} />}
          onClick={() => setCurrentStep("review")}
        >
          Continue to Review
        </Button>
      </div>
    </div>
  );
}
