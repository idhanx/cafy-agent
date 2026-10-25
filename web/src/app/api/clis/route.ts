import { NextResponse } from "next/server";
import { careerOpsRoot } from "@/lib/career-ops";
import { detectClis } from "@/lib/clis";
import { readRememberedCli } from "@/lib/remembered-cli.mjs";
import { isHosted } from "@/lib/hosted.mjs";
import { hostedSync } from "@/lib/hosted-route";

export const dynamic = "force-dynamic";

// Detects which agnostic CLIs are installed on THIS machine (local-first). The
// web delegates career-ops to one of these in headless mode, on the user's own
// auth/tokens — no API key needed.
async function GET_handler() {
  return NextResponse.json({ clis: detectClis(), remembered: readRememberedCli(careerOpsRoot()), hosted: isHosted() });
}

export const GET = hostedSync(GET_handler);
