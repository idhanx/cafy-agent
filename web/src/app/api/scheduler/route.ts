import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveCodeRoot } from "@/lib/core/code-root.mjs";
import { schedulerStatus } from "@/lib/scheduler-status";
import { hostedSync } from "@/lib/hosted-route";
import { isHosted } from "@/lib/hosted.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function runnerScript() {
  return path.join(resolveCodeRoot(process.cwd(), process.env), "web", "scripts", "scheduled-jobs-runner.mjs");
}

async function GET_handler() {
  return NextResponse.json(await schedulerStatus(), { headers: { "Cache-Control": "no-store" } });
}

async function POST_handler() {
  if (isHosted()) return NextResponse.json({ error: "Scheduled scans are not available on the hosted version." }, { status: 501 });
  const script = runnerScript();
  if (!fs.existsSync(script)) {
    return NextResponse.json({ error: "Scheduled job runner is not installed." }, { status: 404 });
  }

  try {
    const child = spawn(process.execPath, [script], {
      cwd: resolveCodeRoot(process.cwd(), process.env),
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      child.once("spawn", () => {
        settled = true;
        resolve();
      });
      child.once("error", (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      });
    });
    child.unref();
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Could not start the local scheduled-job runner." }, { status: 500 });
  }
}

export const GET = hostedSync(GET_handler);
export const POST = hostedSync(POST_handler);
