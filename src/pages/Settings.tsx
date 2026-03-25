import { useState, useEffect } from "react";
import {
  FolderOpen,
  KeyRound,
  Sliders,
  FileText,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Save,
} from "lucide-react";
import { useSettingsStore } from "../stores/settingsStore";
import { getAllSettings, setSetting } from "../lib/database";
import {
  testClaudeApi,
  testCleanvoiceApi,
  selectOutputDirectory,
} from "../lib/tauri";
import { Tabs, TabPanel } from "../components/ui/Tabs";
import type { TabItem } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PasswordInput } from "../components/ui/Input";

const DEFAULT_TEMPLATE = `You are an expert podcast show notes writer for "Modern Ancestral Mamas" — a podcast about ancestral health, natural living, and motherhood.

Create comprehensive, engaging show notes from the provided transcript. Include:
1. A compelling 2-3 sentence episode summary
2. Key takeaways (5-7 bullet points)
3. Topics covered (with approximate timestamps if available)
4. Notable quotes
5. Resources mentioned
6. About the guest (if applicable)

Write in a warm, approachable tone that matches the podcast's community. Use markdown formatting.`;

const TABS: TabItem[] = [
  { id: "general", label: "General", icon: <Sliders size={14} /> },
  { id: "api-keys", label: "API Keys", icon: <KeyRound size={14} /> },
  { id: "presets", label: "Audio Presets", icon: <Sliders size={14} /> },
  { id: "templates", label: "Templates", icon: <FileText size={14} /> },
];

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

function ToggleSwitch({ checked, onChange, label, description }: ToggleSwitchProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
      }}
    >
      {(label || description) && (
        <div>
          {label && (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                fontWeight: "500",
                color: "var(--color-cream)",
                marginBottom: "2px",
              }}
            >
              {label}
            </p>
          )}
          {description && (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                color: "var(--color-text-muted)",
              }}
            >
              {description}
            </p>
          )}
        </div>
      )}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: "44px",
          height: "24px",
          borderRadius: "12px",
          border: "none",
          cursor: "pointer",
          backgroundColor: checked ? "var(--color-sage)" : "var(--color-border)",
          position: "relative",
          flexShrink: 0,
          transition: "background-color 200ms ease",
          padding: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "3px",
            left: checked ? "23px" : "3px",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            backgroundColor: "var(--color-cream)",
            transition: "left 200ms cubic-bezier(0.34, 1.6, 0.64, 1)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        />
      </button>
    </div>
  );
}

export function Settings() {
  const [activeTab, setActiveTab] = useState("general");
  const store = useSettingsStore();

  // Local state that mirrors settings (to allow "save" semantics)
  const [enhancedVideoDir, setEnhancedVideoDir] = useState(store.enhancedVideoDirectory);
  const [extractedAudioDir, setExtractedAudioDir] = useState(store.extractedAudioDirectory);
  const [showNotesDir, setShowNotesDir] = useState(store.showNotesDirectory);
  const [namingTemplate, setNamingTemplate] = useState(store.fileNamingTemplate);
  const [autoIncrement, setAutoIncrement] = useState(store.autoIncrementEpisode);
  const [claudeKey, setClaudeKey] = useState(store.claudeApiKey);
  const [cleanvoiceKey, setCleanvoiceKey] = useState(store.aiEnhancementApiKey);
  const [showNotesTemplate, setShowNotesTemplate] = useState(DEFAULT_TEMPLATE);

  // API test state
  const [claudeTestStatus, setClaudeTestStatus] = useState<
    "idle" | "testing" | "ok" | "fail"
  >("idle");
  const [cleanvoiceTestResult, setCleanvoiceTestResult] = useState<boolean | null>(null);
  const [cleanvoiceTestLoading, setCleanvoiceTestLoading] = useState(false);

  const [saved, setSaved] = useState<Record<string, boolean>>({});

  // Load settings from database on mount
  useEffect(() => {
    getAllSettings().then((settings) => {
      store.loadSettings(settings);
      setEnhancedVideoDir(settings.enhancedVideoDirectory || "");
      setExtractedAudioDir(settings.extractedAudioDirectory || settings.outputDirectory || "");
      setShowNotesDir(settings.showNotesDirectory || "");
      setNamingTemplate(settings.fileNamingTemplate || "MAM-{episode_number}-{title}");
      setAutoIncrement(settings.autoIncrementEpisode !== "false");
      setClaudeKey(settings.claudeApiKey || "");
      setCleanvoiceKey(settings.aiEnhancementApiKey || "");
      setShowNotesTemplate(settings.showNotesTemplate || DEFAULT_TEMPLATE);
    });
  }, []);

  const saveSetting = async (key: string, value: string) => {
    await setSetting(key, value);
    setSaved((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 2000);
  };

  const handleSelectDir = async (
    setter: (dir: string) => void,
    storeSetter: (dir: string) => void,
    settingKey: string
  ) => {
    const dir = await selectOutputDirectory();
    if (dir) {
      setter(dir);
      storeSetter(dir);
      await saveSetting(settingKey, dir);
    }
  };

  const handleTestClaude = async () => {
    if (!claudeKey) return;
    setClaudeTestStatus("testing");
    try {
      const ok = await testClaudeApi(claudeKey);
      setClaudeTestStatus(ok ? "ok" : "fail");
    } catch {
      setClaudeTestStatus("fail");
    }
    setTimeout(() => setClaudeTestStatus("idle"), 5000);
  };

  const handleSaveClaude = async () => {
    store.setClaudeApiKey(claudeKey);
    await saveSetting("claudeApiKey", claudeKey);
  };

  const handleSaveCleanvoice = async () => {
    store.setAiEnhancementApiKey(cleanvoiceKey);
    await saveSetting("aiEnhancementApiKey", cleanvoiceKey);
  };

  const sectionStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    paddingTop: "24px",
  };

  const settingRowStyle: React.CSSProperties = {
    paddingBottom: "24px",
    borderBottom: "1px solid var(--color-border)",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "14px",
    fontWeight: "500",
    color: "var(--color-cream)",
    marginBottom: "4px",
  };

  const descStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "12px",
    color: "var(--color-text-muted)",
    marginBottom: "12px",
    lineHeight: "1.5",
  };

  return (
    <div style={{ padding: "40px", maxWidth: "800px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "40px",
            fontWeight: "600",
            color: "var(--color-cream)",
            lineHeight: "1.1",
            marginBottom: "4px",
          }}
        >
          Settings
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "14px",
            color: "var(--color-text-muted)",
          }}
        >
          Configure your studio preferences and integrations.
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: General */}
      <TabPanel id="general" activeTab={activeTab}>
        <div style={sectionStyle}>
          {/* Output directories */}
          {[
            {
              key: "enhancedVideoDirectory",
              label: "Enhanced Video Output",
              description: "Where your enhanced video files (with processed audio) will be saved.",
              value: enhancedVideoDir,
              setter: setEnhancedVideoDir,
              storeSetter: store.setEnhancedVideoDirectory,
            },
            {
              key: "extractedAudioDirectory",
              label: "Extracted Audio Output",
              description: "Where your exported audio files (MP3, M4A, WAV) will be saved.",
              value: extractedAudioDir,
              setter: setExtractedAudioDir,
              storeSetter: store.setExtractedAudioDirectory,
            },
            {
              key: "showNotesDirectory",
              label: "Show Notes Output",
              description: "Where your exported show notes files will be saved.",
              value: showNotesDir,
              setter: setShowNotesDir,
              storeSetter: store.setShowNotesDirectory,
            },
          ].map((dirConfig) => (
            <div key={dirConfig.key} style={settingRowStyle}>
              <p style={labelStyle}>{dirConfig.label}</p>
              <p style={descStyle}>{dirConfig.description}</p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  backgroundColor: "var(--color-surface)",
                  border: `1px solid ${dirConfig.value ? "var(--color-border)" : "rgba(196, 116, 90, 0.4)"}`,
                  borderRadius: "10px",
                }}
              >
                <FolderOpen
                  size={16}
                  style={{ color: dirConfig.value ? "var(--color-text-muted)" : "var(--color-terracotta)", flexShrink: 0 }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "13px",
                    color: dirConfig.value ? "var(--color-cream)" : "var(--color-terracotta)",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {dirConfig.value || "Not set — please select a folder"}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    handleSelectDir(dirConfig.setter, dirConfig.storeSetter, dirConfig.key)
                  }
                >
                  Browse
                </Button>
              </div>
            </div>
          ))}

          {/* File naming template */}
          <div style={settingRowStyle}>
            <p style={labelStyle}>File Naming Template</p>
            <p style={descStyle}>
              Use <code style={{ color: "var(--color-sage)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>{"{episode_number}"}</code> and{" "}
              <code style={{ color: "var(--color-sage)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>{"{title}"}</code> as placeholders.
            </p>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <Input
                  value={namingTemplate}
                  onChange={(e) => setNamingTemplate(e.target.value)}
                  placeholder="MAM-{episode_number}-{title}"
                />
              </div>
              <Button
                variant="secondary"
                size="md"
                icon={saved.fileNamingTemplate ? <CheckCircle2 size={14} /> : <Save size={14} />}
                onClick={async () => {
                  store.setFileNamingTemplate(namingTemplate);
                  await saveSetting("fileNamingTemplate", namingTemplate);
                }}
              >
                {saved.fileNamingTemplate ? "Saved!" : "Save"}
              </Button>
            </div>
            {namingTemplate && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                  marginTop: "8px",
                }}
              >
                Preview:{" "}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-cream)",
                  }}
                >
                  {namingTemplate
                    .replace("{episode_number}", "42")
                    .replace("{title}", "why-ancestral-foods-matter")}
                  .mp3
                </span>
              </p>
            )}
          </div>

          {/* Auto-increment */}
          <div>
            <ToggleSwitch
              checked={autoIncrement}
              onChange={async (val) => {
                setAutoIncrement(val);
                store.setAutoIncrementEpisode(val);
                await saveSetting("autoIncrementEpisode", String(val));
              }}
              label="Auto-increment Episode Number"
              description="Automatically suggest the next episode number when importing a new video."
            />
          </div>
        </div>
      </TabPanel>

      {/* Tab: API Keys */}
      <TabPanel id="api-keys" activeTab={activeTab}>
        <div style={sectionStyle}>
          {/* Claude API Key */}
          <div style={settingRowStyle}>
            <p style={labelStyle}>Claude API Key</p>
            <p style={descStyle}>
              Required for AI-powered show notes generation. Get your key at{" "}
              <span
                style={{
                  color: "var(--color-sage)",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                console.anthropic.com
              </span>
            </p>
            <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
              <div style={{ flex: 1 }}>
                <PasswordInput
                  value={claudeKey}
                  onChange={(e) => {
                    setClaudeKey(e.target.value);
                    setClaudeTestStatus("idle");
                  }}
                  placeholder="sk-ant-..."
                />
              </div>
              <Button
                variant="secondary"
                size="md"
                onClick={handleTestClaude}
                loading={claudeTestStatus === "testing"}
                disabled={!claudeKey}
                icon={
                  claudeTestStatus === "ok" ? (
                    <CheckCircle2 size={14} style={{ color: "var(--color-sage)" }} />
                  ) : claudeTestStatus === "fail" ? (
                    <XCircle size={14} style={{ color: "#E57373" }} />
                  ) : claudeTestStatus === "testing" ? undefined : (
                    <KeyRound size={14} />
                  )
                }
              >
                {claudeTestStatus === "ok"
                  ? "Connected!"
                  : claudeTestStatus === "fail"
                  ? "Failed"
                  : claudeTestStatus === "testing"
                  ? "Testing..."
                  : "Test"}
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={saved.claudeApiKey ? <CheckCircle2 size={14} /> : <Save size={14} />}
                onClick={handleSaveClaude}
                disabled={!claudeKey}
              >
                {saved.claudeApiKey ? "Saved!" : "Save"}
              </Button>
            </div>
            {claudeTestStatus === "ok" && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  color: "var(--color-sage)",
                }}
              >
                API key is valid and working.
              </p>
            )}
            {claudeTestStatus === "fail" && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  color: "#E57373",
                }}
              >
                Connection failed. Please check your API key.
              </p>
            )}
          </div>

          {/* Cleanvoice AI */}
          <div>
            <p style={labelStyle}>Cleanvoice API Key</p>
            <p style={descStyle}>
              For AI-powered studio sound, noise removal, and voice isolation.{" "}
              <a
                href="https://app.cleanvoice.ai/developer"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--color-sage)", textDecoration: "underline" }}
              >
                Get your API key
              </a>
            </p>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <PasswordInput
                  value={cleanvoiceKey}
                  onChange={(e) => setCleanvoiceKey(e.target.value)}
                  placeholder="Enter your Cleanvoice API key"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveCleanvoice}
                disabled={!cleanvoiceKey}
                icon={<Save size={13} />}
              >
                Save
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  setCleanvoiceTestResult(null);
                  setCleanvoiceTestLoading(true);
                  try {
                    const ok = await testCleanvoiceApi(cleanvoiceKey);
                    setCleanvoiceTestResult(ok);
                  } catch {
                    setCleanvoiceTestResult(false);
                  } finally {
                    setCleanvoiceTestLoading(false);
                  }
                }}
                disabled={!cleanvoiceKey || cleanvoiceTestLoading}
              >
                {cleanvoiceTestLoading ? "Testing..." : "Test"}
              </Button>
            </div>
            {cleanvoiceTestResult === true && (
              <p style={{ ...descStyle, color: "var(--color-sage)", display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                <CheckCircle2 size={13} /> Connected to Cleanvoice AI
              </p>
            )}
            {cleanvoiceTestResult === false && (
              <p style={{ ...descStyle, color: "#E57373", display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                <XCircle size={13} /> Connection failed. Check your API key.
              </p>
            )}
          </div>
        </div>
      </TabPanel>

      {/* Tab: Audio Presets */}
      <TabPanel id="presets" activeTab={activeTab}>
        <div style={sectionStyle}>
          {[
            {
              name: "Light Touch",
              id: "light",
              description:
                "Minimal processing. Applies gentle noise reduction (-10dB) and soft normalization to -16 LUFS. Preserves the natural feel of the recording.",
              suitable: "Best for: Clean studio recordings, professional setups",
            },
            {
              name: "Standard",
              id: "standard",
              description:
                "Balanced processing. Noise reduction (-20dB), dynamic compression (3:1 ratio), high-pass filter at 80Hz, and normalization to -14 LUFS.",
              suitable: "Best for: Most home recordings, typical podcast setups",
            },
            {
              name: "Heavy",
              id: "heavy",
              description:
                "Aggressive processing. Strong noise reduction (-30dB), heavy compression (6:1 ratio), de-essing, and loud normalization to -12 LUFS.",
              suitable: "Best for: Noisy environments, low-quality recordings",
            },
          ].map((preset, i) => (
            <div
              key={preset.id}
              style={{
                ...settingRowStyle,
                ...(i === 2 ? { borderBottom: "none", paddingBottom: 0 } : {}),
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "6px",
                }}
              >
                <p style={{ ...labelStyle, marginBottom: 0 }}>{preset.name}</p>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    fontWeight: "600",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    padding: "2px 7px",
                    backgroundColor: "rgba(122, 139, 111, 0.15)",
                    color: "var(--color-sage)",
                    borderRadius: "5px",
                  }}
                >
                  {preset.id}
                </span>
              </div>
              <p style={descStyle}>{preset.description}</p>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  color: "var(--color-sage)",
                  fontStyle: "italic",
                }}
              >
                {preset.suitable}
              </p>
            </div>
          ))}

          <div
            style={{
              padding: "16px 20px",
              backgroundColor: "var(--color-surface)",
              border: "1px dashed var(--color-border)",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <Sliders size={16} style={{ color: "var(--color-text-muted)" }} />
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                color: "var(--color-text-muted)",
              }}
            >
              Custom presets are coming in a future update. You'll be able to
              define your own FFmpeg filter chains.
            </p>
          </div>
        </div>
      </TabPanel>

      {/* Tab: Templates */}
      <TabPanel id="templates" activeTab={activeTab}>
        <div style={sectionStyle}>
          <div>
            <p style={labelStyle}>Show Notes System Prompt</p>
            <p style={descStyle}>
              This prompt is sent to Claude along with the transcript to generate
              show notes. Customize it to match your podcast's style and format.
            </p>
            <textarea
              value={showNotesTemplate}
              onChange={(e) => setShowNotesTemplate(e.target.value)}
              rows={16}
              style={{
                width: "100%",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                lineHeight: "1.65",
                color: "var(--color-cream)",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "10px",
                padding: "16px",
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
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <Button
              variant="ghost"
              size="md"
              icon={<RotateCcw size={14} />}
              onClick={() => setShowNotesTemplate(DEFAULT_TEMPLATE)}
            >
              Reset to Default
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={
                saved.showNotesTemplate ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <Save size={14} />
                )
              }
              onClick={async () => {
                await saveSetting("showNotesTemplate", showNotesTemplate);
              }}
            >
              {saved.showNotesTemplate ? "Saved!" : "Save Template"}
            </Button>
          </div>
        </div>
      </TabPanel>
    </div>
  );
}
