import { careerOpsRoot, isRegularContainedFile } from "@/lib/career-ops";
import { resolvePdfIndexPath } from "@/lib/core/pdf-index";
import { handleDocumentsRequest } from "@/lib/documents";
import { hostedSync } from "@/lib/hosted-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function GET_handler(req: Request) {
  const root = careerOpsRoot();
  const manifestPath = await resolvePdfIndexPath();
  return handleDocumentsRequest(req, root, manifestPath, isRegularContainedFile);
}

export const GET = hostedSync(GET_handler);
