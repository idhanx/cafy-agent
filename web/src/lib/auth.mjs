// auth.mjs — the password gate for a hosted deployment. One deployment serves one
// client, so a single shared password (CAFY_APP_PASSWORD) is the whole login. The
// session is a signed, expiring cookie: nothing is stored server-side, so it
// survives serverless cold starts and works across instances.
import crypto from "node:crypto";

export const SESSION_COOKIE = "cafy_session";
export const SESSION_TTL_S = 60 * 60 * 24 * 14;

export function passwordFrom(env = process.env) {
  return (env.CAFY_APP_PASSWORD || "").trim();
}

/** HMAC key: AUTH_SECRET when set, else derived from the password itself. */
function signingKey(env) {
  const base = (env.AUTH_SECRET || "").trim() || passwordFrom(env);
  return crypto.createHash("sha256").update(`cafy-session/v1|${base}`).digest();
}

const sign = (payload, env) => crypto.createHmac("sha256", signingKey(env)).update(payload).digest("base64url");

export function createSession(env = process.env, now = Date.now()) {
  const exp = Math.floor(now / 1000) + SESSION_TTL_S;
  const nonce = crypto.randomBytes(8).toString("base64url");
  const payload = `${exp}.${nonce}`;
  return `${payload}.${sign(payload, env)}`;
}

export function verifySession(token, env = process.env, now = Date.now()) {
  if (!passwordFrom(env) || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [exp, nonce, mac] = parts;
  const expected = sign(`${exp}.${nonce}`, env);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(exp) > Math.floor(now / 1000);
}

export function checkPassword(given, env = process.env) {
  const want = passwordFrom(env);
  if (!want || typeof given !== "string") return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(want).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Only same-site relative paths may be a post-login destination. */
export function safeNext(next) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
}

// Per-instance brake on password guessing: 8 misses in 10 minutes locks that
// client address out for the rest of the window.
const misses = new Map();
const WINDOW_MS = 10 * 60_000;
export function tooManyMisses(key, now = Date.now()) {
  const list = (misses.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  misses.set(key, list);
  return list.length >= 8;
}
export function recordMiss(key, now = Date.now()) {
  misses.set(key, [...(misses.get(key) ?? []), now]);
}
export function clearMisses(key) {
  misses.delete(key);
}
