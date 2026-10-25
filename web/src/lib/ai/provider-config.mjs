// provider-config.mjs — where the built-in OpenRouter engine finds its key.
//
// Order: OPENROUTER_API_KEY in the environment (what a Vercel deployment sets),
// then a key saved from Settings → AI provider. The saved key lives in the data
// root (config/ai-provider.json) so it follows the rest of the user's data; it is
// AES-256-GCM encrypted whenever a server secret exists (AUTH_SECRET / CAFY_SECRET
// / CAFY_APP_PASSWORD), and a hosted deployment refuses to store one without a
// secret rather than writing it in clear.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";
export const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const FILE = ["config", "ai-provider.json"];

/** The secret that protects a stored key, or "" when the server has none. */
export function serverSecret(env = process.env) {
  return (env.CAFY_SECRET || env.AUTH_SECRET || env.CAFY_APP_PASSWORD || "").trim();
}

export function configPath(dataRoot) {
  return path.join(dataRoot, ...FILE);
}

function deriveKey(secret) {
  return crypto.scryptSync(secret, "cafy-agent/ai-provider/v1", 32);
}

export function encryptKey(apiKey, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const enc = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return { enc: "aes-256-gcm", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: enc.toString("base64") };
}

export function decryptKey(blob, secret) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(secret), Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(blob.data, "base64")), decipher.final()]).toString("utf8");
}

function readStored(dataRoot, env) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPath(dataRoot), "utf8"));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  let apiKey = "";
  if (raw.key && typeof raw.key === "object") {
    const secret = serverSecret(env);
    if (!secret) return { model: raw.model, apiKey: "", locked: true };
    try {
      apiKey = decryptKey(raw.key, secret);
    } catch {
      return { model: raw.model, apiKey: "", locked: true };
    }
  } else if (typeof raw.key === "string") {
    apiKey = raw.key;
  }
  return { model: typeof raw.model === "string" ? raw.model : "", apiKey, locked: false };
}

/**
 * @returns {{apiKey: string, model: string, baseUrl: string, source: "env"|"saved"|"none", locked: boolean}}
 */
export function resolveAiConfig(dataRoot, env = process.env) {
  const stored = dataRoot ? readStored(dataRoot, env) : null;
  const envKey = (env.OPENROUTER_API_KEY || "").trim();
  const model = (env.CAFY_AI_MODEL || stored?.model || DEFAULT_MODEL).trim();
  const baseUrl = (env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  if (envKey) return { apiKey: envKey, model, baseUrl, source: "env", locked: false };
  if (stored?.apiKey) return { apiKey: stored.apiKey, model, baseUrl, source: "saved", locked: false };
  return { apiKey: "", model, baseUrl, source: "none", locked: Boolean(stored?.locked) };
}

export function hasAiKey(dataRoot, env = process.env) {
  return Boolean(resolveAiConfig(dataRoot, env).apiKey);
}

export function maskKey(key) {
  if (!key) return "";
  return key.length <= 10 ? "••••" : `${key.slice(0, 7)}…${key.slice(-4)}`;
}

/**
 * Save (or, with apiKey omitted, keep) the key and model chosen in Settings.
 * @param {string} dataRoot
 * @param {{apiKey?: string, model?: string}} next
 * @param {{env?: NodeJS.ProcessEnv, hosted?: boolean}} [opts]
 */
export function saveAiConfig(dataRoot, next, { env = process.env, hosted = false } = {}) {
  const file = configPath(dataRoot);
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(file, "utf8")) || {};
  } catch {
    /* first save */
  }
  const out = { model: (next.model ?? prev.model ?? "").trim() || undefined, key: prev.key };
  if (typeof next.apiKey === "string" && next.apiKey.trim()) {
    const apiKey = next.apiKey.trim();
    const secret = serverSecret(env);
    if (secret) out.key = encryptKey(apiKey, secret);
    else if (hosted) throw new Error("Set AUTH_SECRET (or CAFY_APP_PASSWORD) on the server before saving a key here, or set OPENROUTER_API_KEY in the environment instead.");
    else out.key = apiKey;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2), { mode: 0o600 });
}

export function clearAiKey(dataRoot) {
  try {
    const file = configPath(dataRoot);
    const prev = JSON.parse(fs.readFileSync(file, "utf8"));
    delete prev.key;
    fs.writeFileSync(file, JSON.stringify(prev, null, 2), { mode: 0o600 });
  } catch {
    /* nothing saved */
  }
}
