"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type Status = { hosted: boolean; storage: boolean; ai: boolean; engine: boolean; password: boolean };

/** Tells whoever opens a hosted deployment what is still missing, in plain words. */
export function HostedBanner() {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    fetch("/api/hosted-status").then((r) => r.json()).then(setS).catch(() => {});
  }, []);
  if (!s?.hosted) return null;
  const issues: React.ReactNode[] = [];
  if (!s.engine) issues.push("The engine files are missing from this deployment, so scans and evaluations can't run. Redeploy with the repository root included.");
  if (!s.storage) issues.push("No Blob storage is connected, so anything you save is lost when the server restarts. Add a private Vercel Blob store to the project.");
  if (!s.ai) issues.push(<>No AI provider is connected yet. <Link href="/config" className="font-medium underline">Connect one in Settings</Link> to switch on the AI features.</>);
  if (issues.length === 0) return null;
  return (
    <div role="status" className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[13px] text-foreground">
      {issues.map((m, i) => (
        <p key={i} className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" /> <span>{m}</span>
        </p>
      ))}
    </div>
  );
}
