import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { linkEngineInto } from "../../src/lib/hosted-layout.mjs";
import { createSync } from "../../src/lib/hosted-sync.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "cafy-layout-"));

function fakeEngine() {
  const e = tmp();
  for (const f of ["scan-ats-full.mjs", "set-status.mjs", "package.json", "VERSION", "AGENTS.md"]) fs.writeFileSync(path.join(e, f), "x");
  fs.mkdirSync(path.join(e, "modes")); for (const f of ["oferta.md", "_shared.md", "_profile.md"]) fs.writeFileSync(path.join(e, "modes", f), "m");
  fs.mkdirSync(path.join(e, "templates")); fs.writeFileSync(path.join(e, "templates", "states.yml"), "s");
  fs.mkdirSync(path.join(e, "lib")); fs.writeFileSync(path.join(e, "lib", "local-today.mjs"), "l");
  fs.mkdirSync(path.join(e, "batch", "tracker-additions"), { recursive: true }); fs.writeFileSync(path.join(e, "batch", "batch-prompt.md"), "b");
  // a developer's own files sitting in the checkout — must never reach a client
  fs.writeFileSync(path.join(e, "cv.md"), "DEV CV"); fs.mkdirSync(path.join(e, "data")); fs.writeFileSync(path.join(e, "data", "applications.md"), "DEV");
  fs.mkdirSync(path.join(e, "config")); fs.writeFileSync(path.join(e, "config", "profile.example.yml"), "ex"); fs.writeFileSync(path.join(e, "config", "profile.yml"), "DEV PROFILE");
  fs.writeFileSync(path.join(e, ".env"), "SECRET=1"); fs.writeFileSync(path.join(e, "portals.yml"), "dev");
  return e;
}

test("engine files appear in the data folder; the developer's personal files never do", () => {
  const engine = fakeEngine(); const data = tmp();
  linkEngineInto(engine, data);
  for (const f of ["scan-ats-full.mjs", "modes/oferta.md", "modes/_shared.md", "templates/states.yml", "lib/local-today.mjs", "batch/batch-prompt.md", "VERSION", "config/profile.example.yml"]) {
    assert.ok(fs.existsSync(path.join(data, f)), f);
  }
  for (const f of ["cv.md", "data", ".env", "portals.yml", "modes/_profile.md", "batch/tracker-additions", "config/profile.yml"]) {
    assert.ok(!fs.existsSync(path.join(data, f)), `${f} must not be linked`);
  }
});

test("a client's own file is never replaced, and re-linking is idempotent", () => {
  const engine = fakeEngine(); const data = tmp();
  fs.mkdirSync(path.join(data, "modes"));
  fs.writeFileSync(path.join(data, "modes", "_profile.md"), "CLIENT PROFILE");
  fs.writeFileSync(path.join(data, "modes", "oferta.md"), "client override");
  assert.ok(linkEngineInto(engine, data) > 0);
  assert.equal(linkEngineInto(engine, data), 0);
  assert.equal(fs.readFileSync(path.join(data, "modes", "_profile.md"), "utf8"), "CLIENT PROFILE");
  assert.equal(fs.readFileSync(path.join(data, "modes", "oferta.md"), "utf8"), "client override");
});

test("linked engine files are not uploaded to storage", async () => {
  const engine = fakeEngine(); const data = tmp();
  linkEngineInto(engine, data);
  fs.writeFileSync(path.join(data, "cv.md"), "client cv");
  const put = [];
  const store = { list: async () => [], get: async () => null, put: async (p) => { put.push(p); }, del: async () => {} };
  const sync = createSync({ store, root: data });
  await sync.ready();
  await sync.flush();
  assert.deepEqual(put, ["data/cv.md"]);
});

import { ensureTracker } from "../../src/lib/report-persist.mjs";

test("a first evaluation gets a tracker to merge into; an existing tracker is left alone", () => {
  const root = tmp();
  assert.equal(ensureTracker(root, {}), true);
  const file = path.join(root, "data", "applications.md");
  assert.match(fs.readFileSync(file, "utf8"), /\| # \| Date \| Company \| Role \| Score \| Status \| PDF \| Report \| Notes \| URL \|/);
  fs.appendFileSync(file, "| 1 | 2026-01-01 | Acme | Eng | 4.0/5 | Applied | ❌ | — | — |\n");
  assert.equal(ensureTracker(root, {}), false);
  assert.match(fs.readFileSync(file, "utf8"), /Acme/);
  const legacyRoot = tmp();
  fs.writeFileSync(path.join(legacyRoot, "applications.md"), "# x\n");
  assert.equal(ensureTracker(legacyRoot, {}), false, "a root-level tracker counts as one");
  assert.ok(!fs.existsSync(path.join(legacyRoot, "data", "applications.md")));
  const custom = tmp();
  assert.equal(ensureTracker(custom, { CAREER_OPS_TRACKER: "elsewhere/track.md" }), true);
  assert.ok(fs.existsSync(path.join(custom, "elsewhere", "track.md")));
});
