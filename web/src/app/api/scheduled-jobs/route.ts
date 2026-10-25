import { NextResponse } from "next/server";
import {
  createScheduledJob,
  listScheduledJobs,
  parseScheduledJobInput,
  ScheduledJobValidationError,
} from "@/lib/scheduled-jobs";
import { hostedSync } from "@/lib/hosted-route";

function apiError(error: unknown, fallback: string) {
  if (error instanceof ScheduledJobValidationError || (error instanceof SyntaxError)) return { status: 400, body: { error: error.message || fallback } };
  if (error instanceof Error && /lock timeout/i.test(error.message)) return { status: 409, body: { error: "Scheduled jobs are busy; try again." } };
  return { status: 500, body: { error: fallback } };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function GET_handler() {
  try {
    return NextResponse.json(listScheduledJobs(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = apiError(error, "Could not read scheduled jobs.");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}

async function POST_handler(req: Request) {
  try {
    const fields = parseScheduledJobInput(await req.json());
    const job = await createScheduledJob(fields);
    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    const failure = apiError(error, "Could not create scheduled job.");
    return NextResponse.json(failure.body, { status: failure.status });
  }
}

export const GET = hostedSync(GET_handler);
export const POST = hostedSync(POST_handler);
