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
  testPodbeanApi,
  youtubeOAuthStart,
  selectOutputDirectory,
  getDefaultSystemPrompt,
} from "../lib/tauri";
import { Tabs, TabPanel } from "../components/ui/Tabs";
import type { TabItem } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PasswordInput } from "../components/ui/Input";

// Default template is fetched from the Rust backend (single source of truth)
let DEFAULT_TEMPLATE = "";
getDefaultSystemPrompt().then((p) => { DEFAULT_TEMPLATE = p; }).catch(() => {});

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
  const [removeBgKey, setRemoveBgKey] = useState(store.removeBgApiKey);
  const [podbeanClientId, setPodbeanClientId] = useState(store.podbeanClientId);
  const [podbeanClientSecret, setPodbeanClientSecret] = useState(store.podbeanClientSecret);
  const [youtubeClientId, setYoutubeClientId] = useState(store.youtubeClientId);
  const [youtubeClientSecret, setYoutubeClientSecret] = useState(store.youtubeClientSecret);
  const [showNotesTemplate, setShowNotesTemplate] = useState(DEFAULT_TEMPLATE);

  // API test state
  const [claudeTestStatus, setClaudeTestStatus] = useState<
    "idle" | "testing" | "ok" | "fail"
  >("idle");
  const [cleanvoiceTestResult, setCleanvoiceTestResult] = useState<boolean | null>(null);
  const [cleanvoiceTestLoading, setCleanvoiceTestLoading] = useState(false);
  const [podbeanTestResult, setPodbeanTestResult] = useState<boolean | null>(null);
  const [podbeanTestLoading, setPodbeanTestLoading] = useState(false);
  const [youtubeAuthStatus, setYoutubeAuthStatus] = useState<
    "idle" | "authorizing" | "ok" | "fail"
  >(store.youtubeRefreshToken ? "ok" : "idle");
  const [youtubeAuthError, setYoutubeAuthError] = useState("");

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
      setRemoveBgKey(settings.removeBgApiKey || "");
      setPodbeanClientId(settings.podbeanClientId || "");
      setPodbeanClientSecret(settings.podbeanClientSecret || "");
      setYoutubeClientId(settings.youtubeClientId || "");
      setYoutubeClientSecret(settings.youtubeClientSecret || "");
      if (settings.youtubeRefreshToken) {
        setYoutubeAuthStatus("ok");
      }
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
                    await testCleanvoiceApi(cleanvoiceKey);
                    setCleanvoiceTestResult(true);
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

          {/* remove.bg API Key */}
          <div style={settingRowStyle}>
            <p style={labelStyle}>remove.bg API Key</p>
            <p style={descStyle}>
              For automatic background removal in thumbnail creation.{" "}
              <a
                href="https://www.remove.bg/api"
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
                  value={removeBgKey}
                  onChange={(e) => setRemoveBgKey(e.target.value)}
                  placeholder="Enter your remove.bg API key"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  store.setRemoveBgApiKey(removeBgKey);
                  await saveSetting("removeBgApiKey", removeBgKey);
                }}
                disabled={!removeBgKey}
                icon={saved.removeBgApiKey ? <CheckCircle2 size={13} /> : <Save size={13} />}
              >
                {saved.removeBgApiKey ? "Saved!" : "Save"}
              </Button>
            </div>
          </div>

          {/* Podbean */}
          <div style={settingRowStyle}>
            <p style={labelStyle}>Podbean API Credentials</p>
            <p style={descStyle}>
              Required for publishing episodes to Podbean. Get your credentials at{" "}
              <a
                href="https://developers.podbean.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--color-sage)", textDecoration: "underline" }}
              >
                developers.podbean.com
              </a>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ ...descStyle, marginBottom: "4px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Client ID</p>
                  <PasswordInput
                    value={podbeanClientId}
                    onChange={(e) => setPodbeanClientId(e.target.value)}
                    placeholder="Enter your Podbean Client ID"
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ ...descStyle, marginBottom: "4px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Client Secret</p>
                  <PasswordInput
                    value={podbeanClientSecret}
                    onChange={(e) => setPodbeanClientSecret(e.target.value)}
                    placeholder="Enter your Podbean Client Secret"
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    store.setPodbeanClientId(podbeanClientId);
                    store.setPodbeanClientSecret(podbeanClientSecret);
                    await saveSetting("podbeanClientId", podbeanClientId);
                    await saveSetting("podbeanClientSecret", podbeanClientSecret);
                  }}
                  disabled={!podbeanClientId || !podbeanClientSecret}
                  icon={saved.podbeanClientId ? <CheckCircle2 size={13} /> : <Save size={13} />}
                >
                  {saved.podbeanClientId ? "Saved!" : "Save"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    setPodbeanTestResult(null);
                    setPodbeanTestLoading(true);
                    try {
                      await testPodbeanApi(podbeanClientId, podbeanClientSecret);
                      setPodbeanTestResult(true);
                    } catch {
                      setPodbeanTestResult(false);
                    } finally {
                      setPodbeanTestLoading(false);
                    }
                  }}
                  disabled={!podbeanClientId || !podbeanClientSecret || podbeanTestLoading}
                >
                  {podbeanTestLoading ? "Testing..." : "Test"}
                </Button>
              </div>
            </div>
            {podbeanTestResult === true && (
              <p style={{ ...descStyle, color: "var(--color-sage)", display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                <CheckCircle2 size={13} /> Connected to Podbean
              </p>
            )}
            {podbeanTestResult === false && (
              <p style={{ ...descStyle, color: "#E57373", display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                <XCircle size={13} /> Connection failed. Check your Client ID and Secret.
              </p>
            )}
          </div>

          {/* YouTube */}
          <div>
            <p style={labelStyle}>YouTube API Credentials</p>
            <p style={descStyle}>
              Required for publishing videos to YouTube. Set up OAuth credentials in{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--color-sage)", textDecoration: "underline" }}
              >
                Google Cloud Console
              </a>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <p style={{ ...descStyle, marginBottom: "4px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Client ID</p>
                <PasswordInput
                  value={youtubeClientId}
                  onChange={(e) => setYoutubeClientId(e.target.value)}
                  placeholder="Enter your YouTube OAuth Client ID"
                />
              </div>
              <div>
                <p style={{ ...descStyle, marginBottom: "4px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Client Secret</p>
                <PasswordInput
                  value={youtubeClientSecret}
                  onChange={(e) => setYoutubeClientSecret(e.target.value)}
                  placeholder="Enter your YouTube OAuth Client Secret"
                />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    store.setYoutubeClientId(youtubeClientId);
                    store.setYoutubeClientSecret(youtubeClientSecret);
                    await saveSetting("youtubeClientId", youtubeClientId);
                    await saveSetting("youtubeClientSecret", youtubeClientSecret);
                  }}
                  disabled={!youtubeClientId || !youtubeClientSecret}
                  icon={saved.youtubeClientId ? <CheckCircle2 size={13} /> : <Save size={13} />}
                >
                  {saved.youtubeClientId ? "Saved!" : "Save"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    if (!youtubeClientId || !youtubeClientSecret) return;
                    setYoutubeAuthStatus("authorizing");
                    setYoutubeAuthError("");
                    try {
                      // Save credentials first
                      store.setYoutubeClientId(youtubeClientId);
                      store.setYoutubeClientSecret(youtubeClientSecret);
                      await saveSetting("youtubeClientId", youtubeClientId);
                      await saveSetting("youtubeClientSecret", youtubeClientSecret);
                      // Start OAuth flow (opens browser)
                      const token = await youtubeOAuthStart(youtubeClientId, youtubeClientSecret);
                      if (token.refresh_token) {
                        store.setYoutubeRefreshToken(token.refresh_token);
                        await saveSetting("youtubeRefreshToken", token.refresh_token);
                      }
                      setYoutubeAuthStatus("ok");
                    } catch (err) {
                      setYoutubeAuthStatus("fail");
                      setYoutubeAuthError(String(err));
                    }
                  }}
                  disabled={!youtubeClientId || !youtubeClientSecret || youtubeAuthStatus === "authorizing"}
                  icon={
                    youtubeAuthStatus === "ok" ? (
                      <CheckCircle2 size={13} style={{ color: "var(--color-sage)" }} />
                    ) : youtubeAuthStatus === "fail" ? (
                      <XCircle size={13} style={{ color: "#E57373" }} />
                    ) : undefined
                  }
                >
                  {youtubeAuthStatus === "authorizing"
                    ? "Waiting for browser..."
                    : youtubeAuthStatus === "ok"
                    ? "Authorized"
                    : "Authorize YouTube"}
                </Button>
              </div>
            </div>
            {youtubeAuthStatus === "ok" && (
              <p style={{ ...descStyle, color: "var(--color-sage)", display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                <CheckCircle2 size={13} /> YouTube account connected
              </p>
            )}
            {youtubeAuthStatus === "fail" && (
              <p style={{ ...descStyle, color: "#E57373", display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                <XCircle size={13} /> {youtubeAuthError || "Authorization failed. Please try again."}
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
