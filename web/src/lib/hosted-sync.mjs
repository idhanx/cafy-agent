// hosted-sync.mjs — keep a hosted deployment's data folder durable.
//
// The app (and the core scripts it runs) read and write ordinary files: cv.md,
// data/applications.md, reports/… A serverless function's disk is temporary and
// per-instance, so on Vercel that folder is a working copy of a private Vercel Blob
// store — loaded when an instance starts, refreshed when another instance changed
// something, and written back after every request that touched it.
//
// The engine only needs a `store` ({list, get, put, del}); blob-store.mjs supplies
// the real one and tests supply an in-memory one. Optional `rev` ({get, bump}) is a
// cheap shared counter (Upstash/Vercel KV) so an instance can tell "someone else
// wrote" with one tiny read instead of listing the store on every request.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const CONCURRENCY = 8;

// Never synced: caches, lock files, temp files — they only make sense on one machine.
const IGNORE = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)data\/(cache|tmp)(\/|$)/,
  /(^|\/)\.career-ops-web(\/|$)/, // logo cache and other per-machine web scratch
  /\.lock(\/|$)/,
  /\.tmp(\.|$)/,
  /(^|\/)\.[^/]*\.tmp/,
  /(^|\/)\.career-ops-data$/,
];
export const isIgnored = (rel) => IGNORE.some((re) => re.test(rel));

async function pool(items, worker, n = CONCURRENCY) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift());
  }));
}

function walk(root, dir = root, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(root, abs).split(path.sep).join("/");
    if (isIgnored(rel + (e.isDirectory() ? "/" : ""))) continue;
    if (e.isDirectory()) walk(root, abs, out);
    else if (e.isFile()) out.push({ rel, abs });
  }
  return out;
}

const sha = (buf) => crypto.createHash("sha1").update(buf).digest("hex");

/**
 * @param {{store: {list(prefix: string): Promise<{pathname: string, sig: string}[]>, get(pathname: string): Promise<Buffer|null>, put(pathname: string, body: Buffer): Promise<string|void>, del(pathnames: string[]): Promise<void>}, root: string, prefix?: string, rev?: {get(): Promise<string|null>, bump(): Promise<string|null>}|null, minListIntervalMs?: number, now?: () => number}} opts
 */
export function createSync({ store, root, prefix = "data/", rev = null, minListIntervalMs = 10_000, now = Date.now }) {
  /** rel path → what we last loaded/wrote: content hash + stat + the store's signature */
  const known = new Map();
  let hydrated = null;
  let knownRev = null;
  let lastList = 0;
  let flushing = Promise.resolve();

  const blobName = (rel) => prefix + rel;
  const relName = (pathname) => pathname.slice(prefix.length);

  function writeLocal(rel, buf) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
    const st = fs.statSync(abs);
    return { hash: sha(buf), mtimeMs: st.mtimeMs, size: st.size };
  }

  async function pull(entries) {
    await pool(entries, async (e) => {
      const rel = relName(e.pathname);
      if (isIgnored(rel)) return;
      const buf = await store.get(e.pathname);
      if (!buf) return;
      try {
        known.set(rel, { ...writeLocal(rel, buf), sig: e.sig });
      } catch (err) {
        // e.g. a stored file whose path now sits inside a read-only engine folder
        console.warn(`[cafy] skipped ${rel}: ${err instanceof Error ? err.message : err}`);
      }
    });
  }

  async function listRemote() {
    lastList = now();
    return (await store.list(prefix)).filter((e) => e.pathname.startsWith(prefix) && !isIgnored(relName(e.pathname)));
  }

  async function hydrate() {
    fs.mkdirSync(root, { recursive: true });
    await pull(await listRemote());
    try { knownRev = rev ? await rev.get() : null; } catch { knownRev = null; }
  }

  /** Make sure this instance has loaded the store at least once. */
  function ready() {
    if (!hydrated) hydrated = hydrate().catch((e) => { hydrated = null; throw e; });
    return hydrated;
  }

  /** Pick up changes other instances made since we last looked. */
  async function refresh() {
    const remote = await listRemote();
    const remoteNames = new Set(remote.map((e) => relName(e.pathname)));
    const changed = [];
    for (const e of remote) {
      const rel = relName(e.pathname);
      const mine = known.get(rel);
      if (!mine) changed.push(e);
      else if (mine.sig !== e.sig) changed.push(e); // includes a write whose signature we never learned (null)
    }
    await pull(changed);
    for (const [rel] of known) {
      if (!remoteNames.has(rel)) {
        known.delete(rel);
        try { fs.unlinkSync(path.join(root, rel)); } catch { /* already gone */ }
      }
    }
  }

  async function ensureFresh() {
    await ready();
    await flushing; // never refresh over our own pending write
    if (rev) {
      // The counter is an optimisation: if it is unreachable, fall back to listing.
      let current;
      try { current = await rev.get(); } catch { current = undefined; }
      if (current !== undefined) {
        if (current === knownRev) return;
        await refresh();
        knownRev = current;
        return;
      }
    }
    if (now() - lastList < minListIntervalMs) return;
    await refresh();
  }

  async function doFlush() {
    await ready();
    const present = new Map(walk(root).map((f) => [f.rel, f.abs]));
    const puts = [];
    for (const [rel, abs] of present) {
      let st;
      try { st = fs.statSync(abs); } catch { continue; }
      if (st.size > MAX_FILE_BYTES) continue;
      const mine = known.get(rel);
      if (mine && mine.mtimeMs === st.mtimeMs && mine.size === st.size) continue;
      const buf = fs.readFileSync(abs);
      const hash = sha(buf);
      if (mine && mine.hash === hash) { mine.mtimeMs = st.mtimeMs; mine.size = st.size; continue; }
      puts.push({ rel, buf, hash, st });
    }
    const gone = [...known.keys()].filter((rel) => !present.has(rel));
    if (!puts.length && !gone.length) return false;
    await pool(puts, async ({ rel, buf, hash, st }) => {
      // The store reports the new version's signature, so a peer's LATER edit of
      // the same file is still recognised as a change. A store that cannot say
      // (null) just costs one extra download on the next refresh.
      const sig = (await store.put(blobName(rel), buf)) ?? null;
      known.set(rel, { hash, mtimeMs: st.mtimeMs, size: st.size, sig });
    });
    if (gone.length) {
      await store.del(gone.map(blobName));
      gone.forEach((rel) => known.delete(rel));
    }
    if (rev) {
      try { knownRev = await rev.bump(); } catch { /* peers fall back to listing */ }
    }
    return true;
  }

  /** Write local changes back. Serialised, so overlapping requests never interleave uploads. */
  function flush() {
    const run = flushing.then(doFlush, doFlush);
    flushing = run.catch(() => {});
    return run;
  }

  return { ready, ensureFresh, flush, known };
}
