import { NextResponse } from "next/server";
import { careerOpsRoot } from "@/lib/career-ops";
import { resolveAiConfig } from "@/lib/ai/provider-config.mjs";
import { hostedSync } from "@/lib/hosted-route";

export const dynamic = "force-dynamic";

// OpenRouter's public model catalogue, trimmed to what the picker needs. Only
// tool-capable models are listed: the engine drives its work through tool calls.
async function GET_handler() {
  const { baseUrl } = resolveAiConfig(careerOpsRoot());
  try {
    const res = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(15_000), next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ models: [] });
    const json = (await res.json()) as { data?: { id: string; name?: string; supported_parameters?: string[] }[] };
    const models = (json.data ?? [])
      .filter((m) => !m.supported_parameters || m.supported_parameters.includes("tools"))
      .map((m) => ({ id: m.id, name: m.name ?? m.id }))
      .slice(0, 400);
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] });
  }
}

export const GET = hostedSync(GET_handler);
