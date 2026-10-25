import fs from "node:fs";
import path from "node:path";
import { isHosted } from "@/lib/hosted.mjs";
import { createSync } from "@/lib/hosted-sync.mjs";
import { linkEngineInto } from "@/lib/hosted-layout.mjs";
import { kvRevision, storeFromEnv } from "@/lib/blob-store.mjs";

// Everything a hosted deployment needs at runtime, in one place: where the data
// folder is, where the engine files are, and the (optional) Blob-backed sync.

export const hostedDataDir = () => process.env.CAFY_DATA_DIR || "/tmp/cafy-data";

/** The engine checkout (root *.mjs scripts, modes/, templates/): first place that has them. */
export function findEngineRoot(cwd = process.cwd(), env = process.env): string | null {
  const explicit = (env.CAREER_OPS_CODE_ROOT || "").trim();
  const candidates = [explicit && path.resolve(cwd, explicit), path.resolve(cwd, ".."), cwd, path.resolve(cwd, "../.."), "/var/task"].filter(Boolean) as string[];
  return candidates.find((c) => fs.existsSync(path.join(c, "scan-ats-full.mjs")) && fs.existsSync(path.join(c, "modes"))) ?? null;
}

let configured = false;
/** Point the core's path resolution at the hosted layout. Idempotent; a no-op off Vercel. */
export function configureHosted(): void {
  if (configured || !isHosted()) return;
  configured = true;
  const env = process.env;
  env.CAREER_OPS_ROOT ||= hostedDataDir();
  const engine = findEngineRoot();
  if (engine) env.CAREER_OPS_CODE_ROOT ||= engine;
  env.NEXT_TELEMETRY_DISABLED = "1";
  fs.mkdirSync(env.CAREER_OPS_ROOT, { recursive: true });
  // Give the data folder the shape of a full checkout (see hosted-layout.mjs).
  if (engine) linkEngineInto(engine, env.CAREER_OPS_ROOT);
}

export const storageConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID || process.env.CAFY_STORE_DIR);

let sync: ReturnType<typeof createSync> | null | undefined;
/** The Blob-backed sync, or null off Vercel / when no Blob store is attached. */
export function hostedSync() {
  if (sync !== undefined) return sync;
  configureHosted();
  const store = isHosted() ? storeFromEnv() : null;
  sync = store ? createSync({ store, root: process.env.CAREER_OPS_ROOT!, rev: kvRevision() }) : null;
  return sync;
}

/** Load (first call) and refresh the data folder before work that reads it. */
export async function ensureHostedFresh(): Promise<void> {
  configureHosted();
  await hostedSync()?.ensureFresh();
}

export async function flushHosted(): Promise<void> {
  try {
    await hostedSync()?.flush();
  } catch (e) {
    // A failed write-back must be loud: the user's change exists only on this instance.
    console.error("[cafy] could not save data to Blob storage:", e instanceof Error ? e.message : e);
  }
}

let chromiumReady: Promise<void> | null = null;
/**
 * Hosted only: unpack a serverless Chromium and point generate-pdf.mjs at it
 * (CAFY_CHROMIUM_EXECUTABLE / CAFY_CHROMIUM_ARGS — see withHostedChromium there).
 * Called just before a render, so requests that never make a PDF don't pay for it.
 * Never throws: if the browser can't be prepared the render itself fails with its
 * usual readable error, and the tailored CV stays available as HTML.
 */
export function prepareHostedChromium(): Promise<void> {
  if (!isHosted() || process.env.CAFY_CHROMIUM_EXECUTABLE) return Promise.resolve();
  chromiumReady ??= (async () => {
    try {
      const mod = await import("@sparticuz/chromium");
      const chromium = mod.default ?? mod;
      process.env.CAFY_CHROMIUM_EXECUTABLE = await chromium.executablePath();
      process.env.CAFY_CHROMIUM_ARGS = JSON.stringify(chromium.args);
    } catch (e) {
      console.error("[cafy] could not prepare Chromium for PDF rendering:", e instanceof Error ? e.message : e);
      chromiumReady = null; // allow a retry on the next render
    }
  })();
  return chromiumReady;
}
