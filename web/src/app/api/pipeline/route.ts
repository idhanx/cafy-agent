import { pipelineSummary } from "@/lib/career-ops";
import { hostedSync } from "@/lib/hosted-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read fresh local files

// Exposes the user's pipeline (inbox + tracker) to the client so the assistant
// can resolve "all the Anthropic ones" to concrete postings CLIENT-SIDE — the
// model only ever emits a company name, never URLs (no hallucination, no tokens).
async function GET_handler() {
  const s = pipelineSummary();
  return Response.json({
    inbox: s.inbox,
    applications: s.applications,
    root: s.root,
    rootExists: s.rootExists,
  });
}

export const GET = hostedSync(GET_handler);
