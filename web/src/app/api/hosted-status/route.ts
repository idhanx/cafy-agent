import { NextResponse } from "next/server";
import { careerOpsRoot } from "@/lib/career-ops";
import { isHosted } from "@/lib/hosted.mjs";
import { hasAiKey } from "@/lib/ai/provider-config.mjs";
import { findEngineRoot, storageConfigured } from "@/lib/hosted-runtime";
import { passwordFrom } from "@/lib/auth.mjs";
import { hostedSync } from "@/lib/hosted-route";

export const dynamic = "force-dynamic";

// What a deployment still needs before the client can use it. The shell shows the
// missing pieces as a banner, so a misconfigured deploy says so instead of failing
// feature by feature.
async function GET_handler() {
  const hosted = isHosted();
  return NextResponse.json({
    hosted,
    // Without a Blob store, every restart of the server forgets the client's data.
    storage: !hosted || storageConfigured(),
    ai: hasAiKey(careerOpsRoot()),
    engine: !hosted || findEngineRoot() !== null,
    password: !hosted || Boolean(passwordFrom()),
  });
}

export const GET = hostedSync(GET_handler);
