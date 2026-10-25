"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { resolveCliId } from "@/lib/saved-cli";
import { CoMark } from "@/components/co-mark";
import { AssistantConsole } from "@/components/assistant-console";
import { MobileNav } from "@/components/mobile-nav";
import { BackToTop } from "@/components/back-to-top";
import { JobsProvider } from "@/components/jobs/job-store";
import { PipelineProvider } from "@/components/pipeline/pipeline-provider";
import { ApplyProvider } from "@/components/apply/apply-provider";
import { ExploreProvider } from "@/components/explore/explore-provider";
import { FirstScoreView } from "@/components/explore/first-score-view";
import { HostedBanner } from "@/components/hosted-banner";
import { BetaBanner } from "@/components/beta/beta-banner";
import { WorkerPills } from "@/components/jobs/worker-pills";
import { visibleNavItems, isActivePath } from "@/lib/nav-items";

export function AppShell({ children, followupsEnabled, hosted = false, signOut = false }: { children: React.ReactNode; followupsEnabled: boolean; hosted?: boolean; signOut?: boolean }) {
  const pathname = usePathname();
  // Pick (and remember) the AI engine when there is exactly one — e.g. a deployment whose
  // operator set the provider key — so every AI surface works without a visit to Settings.
  useEffect(() => {
    if (pathname !== "/login") void resolveCliId().catch(() => {});
  }, [pathname]);
  // The sign-in screen stands alone: no sidebar, no data providers.
  if (pathname === "/login") return <>{children}</>;
  return (
    <JobsProvider>
      <PipelineProvider>
      <ApplyProvider>
      <ExploreProvider>
      <MobileNav followupsEnabled={followupsEnabled} hosted={hosted} />
      <div className="flex md:min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-3 overflow-y-auto border-r border-border bg-surface px-4 py-5 md:flex">
          <Link href="/" className="flex shrink-0 items-center gap-3 px-2 pb-3" aria-label="Cafy Agent home">
            <CoMark size={34} />
            <span className="text-xl font-semibold tracking-tight text-landing">Cafy Agent</span>
          </Link>
          <nav aria-label="Primary" className="flex flex-col gap-0.5">
            {visibleNavItems(followupsEnabled, hosted).map(({ href, label, icon: Icon, chip }) => {
              const active = isActivePath(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors",
                    active ? "border border-brand/25 bg-[#eaf0fd] text-brand-text shadow-sm" : "border border-transparent text-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px]" />
                  <span className="whitespace-nowrap">{label}</span>
                  {chip && (
                    <span className="ml-auto rounded-full bg-brand px-2 py-px text-[10px] font-semibold text-brand-foreground">{chip}</span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4">
            <WorkerPills />
          </div>
          <div className="mt-auto" />
          {signOut && (
            <form method="post" action="/api/auth/logout" className="px-1">
              <button type="submit" className="text-xs text-muted hover:text-foreground hover:underline">Sign out</button>
            </form>
          )}
          <p className="px-1 pb-14 text-[11px] text-faint">Cafy Agent</p>
        </aside>
        <main className="min-w-0 flex-1 overflow-x-hidden">
          {hosted && <HostedBanner />}
          {children}
        </main>
      </div>
      <AssistantConsole />
      <BackToTop />
      <FirstScoreView />
      <BetaBanner />
      </ExploreProvider>
      </ApplyProvider>
      </PipelineProvider>
    </JobsProvider>
  );
}
