import path from "node:path";
import { engineClosure } from "./scripts/engine-closure.mjs";

// Next sends anonymous usage telemetry unless this is set, and career-ops
// promises none. server.mjs sets it for dev and start; this covers `next build`,
// which npm runs directly and which loads this file before it records anything.
process.env.NEXT_TELEMETRY_DISABLED = "1";

// A hosted build (Vercel sets VERCEL; CAFY_HOSTED=1 reproduces it elsewhere) has to
// ship the engine — the root *.mjs scripts, modes/, templates/ — next to the app,
// because the app runs them as child processes at request time. Nothing imports
// them, so file tracing cannot find them by itself: they are listed here.
const hostedBuild = process.env.CAFY_HOSTED === "1" || (Boolean(process.env.VERCEL) && process.env.CAFY_HOSTED !== "0");
const repoRoot = path.resolve(import.meta.dirname, "..");

const ENGINE_FILES = [
  // The scripts the web code runs, and everything they import (see scripts/engine-closure.mjs).
  ...(hostedBuild ? engineClosure(import.meta.dirname) : []),
  // Data the engine reads at runtime.
  "../providers/**/*", "../modes/**/*", "../templates/**/*", "../fonts/**/*", "../data-static/**/*", "../batch/batch-prompt.md", "../config/*.example.*",
  // The dependencies of those scripts (the repo root has its own, separate from web/).
  "../node_modules/js-yaml/**/*", "../node_modules/argparse/**/*", "../node_modules/dotenv/**/*",
  "../node_modules/undici/**/*", "../node_modules/@google/generative-ai/**/*",
  "../node_modules/playwright/**/*", "../node_modules/playwright-core/**/*",
];
const CHROMIUM = ["./node_modules/@sparticuz/chromium/**/*"];

// Never ship: the owner's personal files (a client deployment starts blank), the test
// suites and docs (scripts that import them would otherwise drag them in), build
// leftovers, and build-machine native packages the running app does not use.
const NEVER_SHIP = [
  "../data/**", "../reports/**", "../output/**", "../jds/**", "../interview-prep/**", "../documents/**", "../writing-samples/**",
  "../cv.md", "../cv.md.bak*", "../portals.yml", "../article-digest.md", "../voice-dna.md", "../config/profile.yml", "../config/cv-facts.json", "../.env*",
  "../tests/**", "../test-fixtures/**", "../docs/**", "../examples/**", "../dashboard/**", "../web/tests/**", "../web/docs/**",
  "./.next-*/**", "./.next/cache/**", "./.next/dev/**", "**/*.map",
  // Build-time only. (Next itself needs @swc/helpers at runtime — never exclude it.)
  "./node_modules/typescript/**", "./node_modules/@typescript/**", "./node_modules/@next/swc-*/**",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Two lockfiles exist on purpose (repo root + web/), so Next would infer the
  // repo root as the workspace root. On Windows that misinference can send
  // Turbopack's postcss workers into an unbounded respawn loop that exhausts
  // all RAM (vercel/next.js#92978) — pin the root to this app. A hosted build
  // pins it to the repo root instead, so the engine files above are inside it.
  turbopack: { root: hostedBuild ? repoRoot : import.meta.dirname },
  // Allow a throwaway build dir (e.g. BUILD_DIST=.next-prod) so a production
  // `next build` can run without clobbering a live `next dev` .next.
  ...(process.env.BUILD_DIST ? { distDir: process.env.BUILD_DIST } : {}),
  ...(hostedBuild
    ? {
        outputFileTracingRoot: repoRoot,
        outputFileTracingExcludes: { "/**/*": NEVER_SHIP },
        outputFileTracingIncludes: { "/**/*": ENGINE_FILES, "/api/run": CHROMIUM, "/api/cv-studio/**/*": CHROMIUM },
        // Must stay on disk, not bundled: it finds its browser binary by relative path.
        serverExternalPackages: ["@sparticuz/chromium"],
      }
    : {}),
};

export default nextConfig;
