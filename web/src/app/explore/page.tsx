import fs from "node:fs";
import { ExplorerView } from "@/components/explore/explorer-view";
import { seedExploreFilters } from "@/lib/core/portals";
import { readInbox, readApplications, careerOpsRoot } from "@/lib/career-ops";
import { DEFAULT_FILTERS } from "@/lib/explore";

// Read live data at request time so a bare checkout (or `next build` with no
// CAREER_OPS_ROOT) never fails — discovery seeds are best-effort.
export const dynamic = "force-dynamic";

export default function ExplorePage() {
  let seed: { filters: typeof DEFAULT_FILTERS; seededFrom: string[] } = { filters: DEFAULT_FILTERS, seededFrom: [] };
  try {
    // Personal seeding (portals.yml / profile.yml → roles, excludes, locations) is
    // opt-in for local use. A deployed instance must start blank, never prefilled
    // with the owner's targeting.
    if (process.env.CAREER_OPS_SEED_EXPLORE === "1") seed = seedExploreFilters();
  } catch {
    /* bare checkout → defaults */
  }
  let rootExists = false;
  try {
    rootExists = fs.existsSync(careerOpsRoot());
  } catch {
    /* ignore */
  }
  return (
    <ExplorerView seed={seed} inboxSnapshot={readInbox()} appsSnapshot={readApplications()} rootExists={rootExists} />
  );
}
