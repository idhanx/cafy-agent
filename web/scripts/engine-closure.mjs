// engine-closure.mjs — which engine files a hosted build must ship.
//
// The web app runs the repo's root scripts as child processes, so nothing imports
// them and file tracing can't see them. Listing every root *.mjs would also ship the
// maintenance scripts (test-all.mjs, updater tests…) and, through their imports, the
// whole test suite. This walks outward from the scripts the web code names, following
// every relative import and every other root script or JSON file mentioned by name,
// and returns exactly that set — as paths relative to web/ (for outputFileTracingIncludes).
import fs from "node:fs";
import path from "node:path";

const IMPORT_RE = /(?:from\s*|import\s*\(\s*|import\s+|require\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name.startsWith(".next-")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** @param {string} webDir absolute path to web/ */
export function engineClosure(webDir) {
  const root = path.resolve(webDir, "..");
  const rootFiles = new Map(); // basename → exists, for root-level .mjs/.json
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (e.isFile() && /\.(mjs|json)$/.test(e.name)) rootFiles.set(e.name, true);
  }
  const scriptNames = [...rootFiles.keys()].filter((n) => n.endsWith(".mjs")).map((n) => n.slice(0, -4));

  // Seeds: any root script/json the web source names ("scan", "merge-tracker.mjs", …).
  const webText = walk(path.join(webDir, "src")).map((f) => fs.readFileSync(f, "utf8")).join("\n");
  const wanted = new Set();
  for (const name of scriptNames) {
    if (new RegExp(`["'\`/]${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\.mjs)?["'\`]`).test(webText)) wanted.add(`${name}.mjs`);
  }
  for (const f of rootFiles.keys()) if (f.endsWith(".json") && webText.includes(f)) wanted.add(f);

  const seen = new Set();
  const queue = [...wanted].map((f) => path.join(root, f));
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    if (!file.endsWith(".mjs")) continue;
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(IMPORT_RE)) {
      const target = path.resolve(path.dirname(file), m[1]);
      for (const cand of [target, `${target}.mjs`, path.join(target, "index.mjs")]) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) { queue.push(cand); break; }
      }
    }
    // Other root scripts / json this script launches or reads by name — but only
    // where the name is passed to a launcher or path builder, not merely mentioned
    // (doctor.mjs lists test-all.mjs in a message; that must not ship the test suite).
    for (const m of src.matchAll(/(?:spawn|spawnSync|execFile|execFileSync|fork|join|resolve|pathToFileURL|readFileSync|existsSync)\s*\([^)]*['"`]([\w.-]+\.(?:mjs|json))['"`]/g)) {
      if (rootFiles.has(m[1])) queue.push(path.join(root, m[1]));
    }
  }
  return [...seen].map((f) => path.relative(webDir, f).split(path.sep).join("/")).sort();
}
