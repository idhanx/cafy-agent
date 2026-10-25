import { Send } from "lucide-react";
import { ApplyView } from "@/components/apply-view";
import { ApplyBackdropMount } from "@/components/apply/apply-backdrop-mount";
import { HostedUnavailable } from "@/components/hosted-unavailable";
import { isHosted } from "@/lib/hosted.mjs";

export const dynamic = "force-dynamic";

export default function ApplyPage() {
  if (isHosted()) {
    return (
      <HostedUnavailable title="Guided apply runs on your own computer" href="/pipeline" cta="Open my applications">
        Guided apply opens a real browser window and fills the form in front of you, so it needs the desktop version. Here, open any application and use its checklist — your tailored CV and ready-to-paste answers are one click away.
      </HostedUnavailable>
    );
  }
  return (
    <div className="relative min-h-screen">
      {/* full-viewport blurred form wallpaper (behind everything) */}
      <ApplyBackdropMount />
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center gap-3">
          <Send className="size-6 text-brand-text" />
          <h1 className="font-display text-2xl tracking-tight text-landing">Apply</h1>
        </div>
        <p className="mt-1.5 max-w-xl text-sm text-muted">
          Cafy Agent reads the real application form on your machine and re-renders it here in plain language, pre-filled
          from your CV. You verify every answer — then it fills the real form behind the scenes and you submit it yourself.
          It never submits for you.
        </p>
        <div className="mt-6">
          <ApplyView />
        </div>
      </div>
    </div>
  );
}
