import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSync, isIgnored } from "../../src/lib/hosted-sync.mjs";
import { kvRevision } from "../../src/lib/blob-store.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "cafy-sync-"));
const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");

/** In-memory stand-in for a private Blob store; counts calls so tests can assert cost. */
function memStore() {
  const files = new Map();
  let clock = 1;
  const calls = { list: 0, get: 0, put: 0, del: 0 };
  return {
    files, calls,
    async list(prefix) { calls.list++; return [...files].filter(([k]) => k.startsWith(prefix)).map(([pathname, v]) => ({ pathname, sig: v.sig })); },
    async get(p) { calls.get++; return files.has(p) ? Buffer.from(files.get(p).body) : null; },
    async put(p, body) { calls.put++; const sig = `v${clock++}`; files.set(p, { body: Buffer.from(body), sig }); return sig; },
    async del(ps) { calls.del++; ps.forEach((p) => files.delete(p)); },
  };
}
function memRev() {
  let n = 0;
  return { calls: 0, get: async function () { this.calls++; return String(n); }, bump: async () => String(++n) };
}

test("a fresh instance loads the stored files", async () => {
  const store = memStore();
  await store.put("data/cv.md", "# Jane");
  await store.put("data/reports/001-x.md", "report");
  const root = tmp();
  const sync = createSync({ store, root });
  await sync.ready();
  assert.equal(read(root, "cv.md"), "# Jane");
  assert.equal(read(root, "reports/001-x.md"), "report");
});

test("flush uploads new and changed files, deletes removed ones, skips caches and locks", async () => {
  const store = memStore();
  await store.put("data/old.md", "old");
  const root = tmp();
  const sync = createSync({ store, root });
  await sync.ready();
  fs.writeFileSync(path.join(root, "cv.md"), "mine");
  fs.mkdirSync(path.join(root, "data", "cache"), { recursive: true });
  fs.writeFileSync(path.join(root, "data", "cache", "x.json"), "{}");
  fs.writeFileSync(path.join(root, "tracker.lock"), "1");
  fs.unlinkSync(path.join(root, "old.md"));
  assert.equal(await sync.flush(), true);
  assert.equal(store.files.get("data/cv.md").body.toString(), "mine");
  assert.ok(!store.files.has("data/old.md"));
  assert.ok(![...store.files.keys()].some((k) => /cache|lock/.test(k)));
});

test("flush with nothing changed makes no network calls", async () => {
  const store = memStore();
  await store.put("data/a.md", "a");
  const root = tmp();
  const sync = createSync({ store, root });
  await sync.ready();
  const before = { ...store.calls };
  assert.equal(await sync.flush(), false);
  assert.deepEqual(store.calls, before);
});

test("rewriting a file with identical content is not re-uploaded", async () => {
  const store = memStore();
  await store.put("data/a.md", "same");
  const root = tmp();
  const sync = createSync({ store, root });
  await sync.ready();
  fs.writeFileSync(path.join(root, "a.md"), "same");
  const puts = store.calls.put;
  await sync.flush();
  assert.equal(store.calls.put, puts);
});

test("two instances stay in step through the shared revision counter", async () => {
  const store = memStore();
  const rev = memRev();
  const aRoot = tmp();
  const bRoot = tmp();
  const a = createSync({ store, root: aRoot, rev });
  const b = createSync({ store, root: bRoot, rev });
  await a.ready();
  await b.ready();
  fs.writeFileSync(path.join(aRoot, "applications.md"), "| 1 | Acme |");
  await a.flush();
  await b.ensureFresh();
  assert.equal(read(bRoot, "applications.md"), "| 1 | Acme |");
  // b edits the same file after a wrote it: a must still see b's edit
  fs.writeFileSync(path.join(bRoot, "applications.md"), "| 1 | Acme | Applied |");
  await b.flush();
  await a.ensureFresh();
  assert.equal(read(aRoot, "applications.md"), "| 1 | Acme | Applied |");
});

test("a store that cannot report a signature costs a re-download, never a missed edit", async () => {
  const base = memStore();
  const store = { ...base, put: async (p, b) => { await base.put(p, b); } };
  const rev = memRev();
  const aRoot = tmp();
  const bRoot = tmp();
  const a = createSync({ store, root: aRoot, rev });
  const b = createSync({ store, root: bRoot, rev });
  await a.ready(); await b.ready();
  fs.writeFileSync(path.join(aRoot, "n.md"), "one");
  await a.flush();
  await b.ensureFresh();
  fs.writeFileSync(path.join(bRoot, "n.md"), "two!");
  await b.flush();
  await a.ensureFresh();
  assert.equal(read(aRoot, "n.md"), "two!");
});

test("an instance does not re-download what it just wrote", async () => {
  const store = memStore();
  const rev = memRev();
  const root = tmp();
  const sync = createSync({ store, root, rev });
  await sync.ready();
  fs.writeFileSync(path.join(root, "x.md"), "x");
  await sync.flush();
  const gets = store.calls.get;
  await sync.ensureFresh();
  assert.equal(store.calls.get, gets);
});

test("without a revision counter, freshness checks are throttled", async () => {
  const store = memStore();
  let t = 0;
  const sync = createSync({ store, root: tmp(), minListIntervalMs: 10_000, now: () => t });
  await sync.ready();
  const lists = store.calls.list;
  t += 5_000;
  await sync.ensureFresh();
  assert.equal(store.calls.list, lists);
  t += 6_000;
  await sync.ensureFresh();
  assert.equal(store.calls.list, lists + 1);
});

test("a broken revision counter degrades to listing instead of failing the request", async () => {
  const store = memStore();
  const bad = { get: async () => { throw new Error("kv down"); }, bump: async () => { throw new Error("kv down"); } };
  const root = tmp();
  const sync = createSync({ store, root, rev: bad, now: () => 1e9 });
  await sync.ready();
  fs.writeFileSync(path.join(root, "a.md"), "a");
  await assert.doesNotReject(sync.flush());
  await assert.doesNotReject(sync.ensureFresh());
});

test("a failed hydrate can be retried", async () => {
  let fail = true;
  const store = { ...memStore(), list: async () => { if (fail) throw new Error("blob down"); return []; } };
  const sync = createSync({ store, root: tmp() });
  await assert.rejects(sync.ready(), /blob down/);
  fail = false;
  await assert.doesNotReject(sync.ready());
});

test("ignore rules", () => {
  for (const rel of ["data/cache/a", "tracker.lock", "data/applications.md.tmp.123", "node_modules/x/y.js", ".git/config", ".career-ops-web/logo-cache/a.png"]) assert.ok(isIgnored(rel), rel);
  for (const rel of ["cv.md", "data/applications.md", "reports/001-a.md", "config/profile.yml", "output/cv.pdf"]) assert.ok(!isIgnored(rel), rel);
});

test("KV revision speaks the Redis REST protocol and is off when unconfigured", async () => {
  assert.equal(kvRevision({}), null);
  const seen = [];
  const fakeFetch = async (url, init) => {
    const body = JSON.parse(init.body);
    seen.push({ url, auth: init.headers.authorization, body });
    return { ok: true, json: async () => ({ result: body[0] === "INCR" ? 7 : null }) };
  };
  const rev = kvRevision({ KV_REST_API_URL: "https://kv.example", KV_REST_API_TOKEN: "t0k" }, fakeFetch);
  assert.equal(await rev.get(), "0");
  assert.equal(await rev.bump(), "7");
  assert.equal(seen[0].auth, "Bearer t0k");
  assert.equal(seen[1].body[0], "INCR");
});

import { dirStore, storeFromEnv } from "../../src/lib/blob-store.mjs";

test("dirStore (the local stand-in for Blob) round-trips through the sync engine", async () => {
  const store = dirStore(tmp());
  const aRoot = tmp();
  const a = createSync({ store, root: aRoot });
  await a.ready();
  fs.mkdirSync(path.join(aRoot, "reports"), { recursive: true });
  fs.writeFileSync(path.join(aRoot, "reports", "001-a.md"), "r1");
  await a.flush();
  const bRoot = tmp();
  const b = createSync({ store, root: bRoot });
  await b.ready();
  assert.equal(read(bRoot, "reports/001-a.md"), "r1");
  fs.unlinkSync(path.join(bRoot, "reports", "001-a.md"));
  await b.flush();
  assert.deepEqual(await store.list("data/"), []);
});

test("storeFromEnv picks the configured store, or none", () => {
  assert.equal(storeFromEnv({}), null);
  assert.ok(storeFromEnv({ CAFY_STORE_DIR: tmp() }));
  assert.ok(storeFromEnv({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x" }));
});
