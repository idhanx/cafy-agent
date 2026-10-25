// blob-store.mjs — the real stores behind hosted-sync.mjs: a PRIVATE Vercel Blob
// store for files, and (optionally) a Redis-compatible REST counter (Upstash / Vercel
// KV) for cheap change detection.
import fs from "node:fs";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";

export function blobStore(token = process.env.BLOB_READ_WRITE_TOKEN) {
  const auth = token ? { token } : {};
  return {
    async list(prefix) {
      const out = [];
      let cursor;
      do {
        const page = await list({ prefix, cursor, limit: 1000, ...auth });
        for (const b of page.blobs) out.push({ pathname: b.pathname, sig: b.etag });
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return out;
    },
    async get(pathname) {
      const res = await get(pathname, { access: "private", useCache: false, ...auth });
      if (!res || res.statusCode !== 200) return null;
      return Buffer.from(await new Response(res.stream).arrayBuffer());
    },
    async put(pathname, body) {
      const res = await put(pathname, body, { access: "private", addRandomSuffix: false, allowOverwrite: true, ...auth });
      return res.etag;
    },
    async del(pathnames) {
      if (pathnames.length) await del(pathnames, auth);
    },
  };
}

/** Shared change counter over the Upstash/Vercel-KV REST API, or null when not configured. */
export function kvRevision(env = process.env, fetchImpl = fetch) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const key = `cafy:${env.VERCEL_PROJECT_ID || "app"}:rev`;
  const cmd = async (...args) => {
    const res = await fetchImpl(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(args) });
    if (!res.ok) throw new Error(`KV ${res.status}`);
    return (await res.json()).result;
  };
  return {
    get: async () => { const v = await cmd("GET", key); return v == null ? "0" : String(v); },
    bump: async () => String(await cmd("INCR", key)),
  };
}

/**
 * A directory standing in for the Blob store — for trying the hosted behaviour on a
 * laptop (CAFY_STORE_DIR=/some/dir). Same interface, same signatures-on-change rule.
 */
export function dirStore(dir) {
  const abs = (p) => path.join(dir, ...p.split("/"));
  const sigOf = (file) => { const st = fs.statSync(file); return `${st.size}:${st.mtimeMs}`; };
  const walk = (d, out = []) => {
    if (!fs.existsSync(d)) return out;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f, out);
      else out.push(f);
    }
    return out;
  };
  return {
    async list(prefix) {
      return walk(dir)
        .map((f) => ({ pathname: path.relative(dir, f).split(path.sep).join("/"), sig: sigOf(f) }))
        .filter((e) => e.pathname.startsWith(prefix));
    },
    async get(pathname) {
      try { return fs.readFileSync(abs(pathname)); } catch { return null; }
    },
    async put(pathname, body) {
      fs.mkdirSync(path.dirname(abs(pathname)), { recursive: true });
      fs.writeFileSync(abs(pathname), body);
      return sigOf(abs(pathname));
    },
    async del(pathnames) {
      for (const p of pathnames) { try { fs.unlinkSync(abs(p)); } catch { /* already gone */ } }
    },
  };
}

/** The store this deployment is configured for, or null when none is. */
export function storeFromEnv(env = process.env) {
  if (env.CAFY_STORE_DIR) return dirStore(env.CAFY_STORE_DIR);
  if (env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID) return blobStore(env.BLOB_READ_WRITE_TOKEN);
  return null;
}
