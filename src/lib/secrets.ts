/**
 * Encrypted secret storage using Tauri Stronghold plugin.
 * API keys and tokens are stored in an encrypted vault rather than plaintext SQLite.
 * Falls back to SQLite storage if Stronghold is unavailable.
 */

import { appDataDir } from "@tauri-apps/api/path";
import type { Stronghold, Store } from "@tauri-apps/plugin-stronghold";

// Lazy-loaded Stronghold store
let storePromise: Promise<{ store: Store; stronghold: Stronghold } | null> | null = null;

const VAULT_PASSWORD = "mam-podcast-studio-vault-v1";

// Keys that should be stored in the encrypted vault
const SECRET_KEYS = new Set([
  "claudeApiKey",
  "aiEnhancementApiKey",
  "removeBgApiKey",
  "podbeanClientId",
  "podbeanClientSecret",
  "youtubeClientId",
  "youtubeClientSecret",
  "youtubeRefreshToken",
]);

export function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key);
}

async function getStore(): Promise<{ store: Store; stronghold: Stronghold } | null> {
  if (!storePromise) {
    storePromise = initStore().catch((err) => {
      console.warn("Stronghold unavailable, secrets will use SQLite fallback:", err);
      storePromise = null;
      return null;
    });
  }
  return storePromise;
}

async function initStore(): Promise<{ store: Store; stronghold: Stronghold }> {
  const { Stronghold: SH } = await import("@tauri-apps/plugin-stronghold");
  const dir = await appDataDir();
  const vaultPath = `${dir}/mam-secrets.hold`;
  const stronghold = await SH.load(vaultPath, VAULT_PASSWORD);

  let client;
  try {
    client = await stronghold.loadClient("mam-api-keys");
  } catch {
    // Client doesn't exist yet — create it
    client = await stronghold.createClient("mam-api-keys");
    await stronghold.save();
  }

  return { store: client.getStore(), stronghold };
}

/**
 * Store a secret in the encrypted vault.
 */
export async function setSecret(key: string, value: string): Promise<boolean> {
  try {
    const ctx = await getStore();
    if (!ctx) return false;
    const encoded = Array.from(new TextEncoder().encode(value));
    await ctx.store.insert(key, encoded);
    await ctx.stronghold.save();
    return true;
  } catch (err) {
    console.error(`Failed to store secret "${key}":`, err);
    return false;
  }
}

/**
 * Retrieve a secret from the encrypted vault.
 */
export async function getSecret(key: string): Promise<string | null> {
  try {
    const ctx = await getStore();
    if (!ctx) return null;
    const data = await ctx.store.get(key);
    if (!data || data.length === 0) return null;
    return new TextDecoder().decode(data);
  } catch (err) {
    console.error(`Failed to read secret "${key}":`, err);
    return null;
  }
}

/**
 * Remove a secret from the encrypted vault.
 */
export async function removeSecret(key: string): Promise<boolean> {
  try {
    const ctx = await getStore();
    if (!ctx) return false;
    await ctx.store.remove(key);
    await ctx.stronghold.save();
    return true;
  } catch (err) {
    console.error(`Failed to remove secret "${key}":`, err);
    return false;
  }
}

/**
 * Load all secrets at once (for settings hydration).
 */
export async function getAllSecrets(): Promise<Record<string, string>> {
  const secrets: Record<string, string> = {};
  for (const key of SECRET_KEYS) {
    const value = await getSecret(key);
    if (value) secrets[key] = value;
  }
  return secrets;
}
