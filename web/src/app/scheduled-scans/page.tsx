import { ScheduledJobsView } from "@/components/scheduled-jobs-view";
import { HostedUnavailable } from "@/components/hosted-unavailable";
import { isHosted } from "@/lib/hosted.mjs";

export const dynamic = "force-dynamic";

export default function ScheduledScansPage() {
  if (isHosted()) {
    return (
      <HostedUnavailable title="Scheduled scans aren't available here" href="/explore" cta="Find jobs now">
        Automatic scans need a computer that stays switched on, so they only run in the desktop version. On this site, open Find jobs to scan whenever you like — it takes a minute.
      </HostedUnavailable>
    );
  }
  return <ScheduledJobsView />;
}
