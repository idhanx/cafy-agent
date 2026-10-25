import { NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";
import { createUsageScanner } from "@/lib/claude-usage-scan.mjs";
import { hostedSync } from "@/lib/hosted-route";
import { isHosted } from "@/lib/hosted.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reads Claude Code's per-message usage across ALL projects (~/.claude/projects/
// **/*.jsonl) and sums tokens in the rolling 5h and 7d windows — the same scope
// as the account's rate-limit windows. Cached 60s. The scanner keeps its place
// in each transcript and reads only what was appended since the last scan, with
// async fs, so a refresh no longer re-reads a week of transcripts while
// blocking the server (lib/claude-usage-scan.mjs).

type Usage = { window5h: { tokens: number; messages: number }; window7d: { tokens: number; messages: number }; computedAt: number };
let cache: { at: number; data: Usage } | null = null;

const scanner = createUsageScanner({ root: path.join(os.homedir(), ".claude", "projects") });

async function GET_handler() {
  // Reads the local machine's Claude logs; a hosted server has none and must not report its own.
  if (isHosted()) return NextResponse.json({ window5h: { tokens: 0, messages: 0 }, window7d: { tokens: 0, messages: 0 }, computedAt: Date.now() });
  if (cache && Date.now() - cache.at < 60_000) return NextResponse.json(cache.data);
  const data = await scanner.compute();
  cache = { at: Date.now(), data };
  return NextResponse.json(data);
}

export const GET = hostedSync(GET_handler);
