import { NextResponse } from "next/server";
import { careerOpsRoot } from "@/lib/career-ops";
import { readJsonObject } from "@/lib/json-body";
import { isHosted } from "@/lib/hosted.mjs";
import { DEFAULT_MODEL, clearAiKey, maskKey, resolveAiConfig, saveAiConfig, serverSecret } from "@/lib/ai/provider-config.mjs";
import { hostedSync } from "@/lib/hosted-route";

export const dynamic = "force-dynamic";

function status() {
  const cfg = resolveAiConfig(careerOpsRoot());
  const hosted = isHosted();
  return {
    hosted,
    connected: Boolean(cfg.apiKey),
    source: cfg.source, // "env" | "saved" | "none"
    locked: cfg.locked, // a saved key exists but this server cannot decrypt it
    maskedKey: maskKey(cfg.apiKey),
    model: cfg.model,
    defaultModel: DEFAULT_MODEL,
    // A hosted server can only keep a pasted key encrypted when it has a secret.
    canSave: !hosted || Boolean(serverSecret()),
  };
}

async function GET_handler() {
  return NextResponse.json(status());
}

/** Ask OpenRouter who this key belongs to — a 401 here means the key is wrong. */
async function checkKey(baseUrl: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${baseUrl}/auth/key`, { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
    if (res.ok) return null;
    if (res.status === 401 || res.status === 403) return "OpenRouter rejected that key. Copy it again from openrouter.ai/keys.";
    return `OpenRouter answered HTTP ${res.status} when checking the key. Try again in a moment.`;
  } catch {
    return "Couldn't reach OpenRouter to check the key. Check the connection and try again.";
  }
}

async function POST_handler(req: Request) {
  const body = await readJsonObject<{ apiKey?: unknown; model?: unknown }>(req);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (apiKey && !/^[\w.\-:]{12,300}$/.test(apiKey)) return NextResponse.json({ error: "That doesn't look like an API key." }, { status: 400 });
  if (model && !/^[\w.\-:/]{3,120}$/.test(model)) return NextResponse.json({ error: "That doesn't look like a model id (for example anthropic/claude-sonnet-4.5)." }, { status: 400 });
  if (!apiKey && !model) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  if (apiKey) {
    const { baseUrl } = resolveAiConfig(careerOpsRoot());
    const bad = await checkKey(baseUrl, apiKey);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  }
  try {
    saveAiConfig(careerOpsRoot(), { apiKey: apiKey || undefined, model: model || undefined }, { hosted: isHosted() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save." }, { status: 400 });
  }
  return NextResponse.json(status());
}

async function DELETE_handler() {
  clearAiKey(careerOpsRoot());
  return NextResponse.json(status());
}

export const GET = hostedSync(GET_handler);
export const POST = hostedSync(POST_handler);
export const DELETE = hostedSync(DELETE_handler);
