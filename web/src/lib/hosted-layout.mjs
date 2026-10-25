// hosted-layout.mjs — give a hosted deployment's data folder the shape of a full
// career-ops checkout, without copying anything.
//
// The engine (root *.mjs scripts, modes/, templates/, lib/…) ships inside the
// deployment and is read-only; the client's files (cv.md, data/, reports/…) live in
// a writable folder that is synced to Blob storage. Plenty of code — prompts, the
// run route's precondition, the portals page — looks for engine files UNDER the data
// root. Linking them in keeps all of that working in one place, and keeps the two
// kinds of file apart: links are never synced, and nothing user-owned is ever linked.
import fs from "node:fs";
import path from "node:path";

// The user's layer (DATA_CONTRACT.md). Never linked from the engine folder, so a
// developer's own files in a checkout can never leak into a client deployment.
const USER_ENTRIES = new Set([
  "cv.md", "data", "reports", "output", "jds", "interview-prep", "documents",
  "writing-samples", "article-digest.md", "portals.yml", "voice-dna.md", ".env", ".env.local",
  ".career-ops-data", ".git", "web", "docs", "examples", "test-fixtures", "dashboard", ".next",
]);
// Folders that hold both engine files and user files: a real folder whose engine
// children are linked individually.
const MIXED = {
  modes: new Set(["_profile.md", "_custom.md", "_brief.md"]),
  batch: new Set(["tracker-additions", "logs", "batch-input.tsv", "batch-state.tsv"]),
};
const LINKABLE_FILE = /\.(mjs|json|md|yml|yaml)$|^VERSION$/;

function link(target, at) {
  try {
    const cur = fs.lstatSync(at);
    if (cur.isSymbolicLink() && fs.readlinkSync(at) === target) return false;
    if (!cur.isSymbolicLink()) return false; // a real file/folder is the user's: leave it
    fs.unlinkSync(at);
  } catch {
    /* nothing there yet */
  }
  fs.symlinkSync(target, at);
  return true;
}

/**
 * @param {string} engineRoot read-only folder with the engine files
 * @param {string} dataRoot writable data folder
 * @returns {number} how many links were created
 */
export function linkEngineInto(engineRoot, dataRoot) {
  if (path.resolve(engineRoot) === path.resolve(dataRoot)) return 0;
  fs.mkdirSync(dataRoot, { recursive: true });
  let made = 0;
  for (const e of fs.readdirSync(engineRoot, { withFileTypes: true })) {
    if (USER_ENTRIES.has(e.name)) continue;
    const from = path.join(engineRoot, e.name);
    const to = path.join(dataRoot, e.name);
    if (e.isDirectory() && e.name === "config") {
      // config/ holds the user's own profile.yml; only the shipped examples are engine files.
      fs.mkdirSync(to, { recursive: true });
      for (const child of fs.readdirSync(from, { withFileTypes: true })) {
        if (child.isFile() && /\.example\./.test(child.name) && link(path.join(from, child.name), path.join(to, child.name))) made++;
      }
    } else if (e.isDirectory() && Object.hasOwn(MIXED, e.name)) {
      fs.mkdirSync(to, { recursive: true });
      for (const child of fs.readdirSync(from, { withFileTypes: true })) {
        if (MIXED[e.name].has(child.name)) continue;
        if (link(path.join(from, child.name), path.join(to, child.name))) made++;
      }
    } else if (e.isDirectory() || (e.isFile() && LINKABLE_FILE.test(e.name))) {
      if (link(from, to)) made++;
    }
  }
  return made;
}
