"use client";

import { displayFont } from "@/lib/fonts";
import { CvIngest } from "@/components/cv/cv-ingest";
import { OnboardingProgress } from "@/components/home/onboarding-progress";

// The first-run takeover: when cv.md is missing, the CV-upload hero IS the home.
// One input, value-coming framing (not a form), the same product chrome (blue accent bar) so it feels like the app, not a gate. The whole aha (CV → free matches
// → first score) flows from here.
export function FirstRunHome() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:py-16">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-border bg-surface px-7 py-10 md:px-10 md:py-12">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand to-brand-200" />
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-text">
            Welcome to Cafy Agent · your private workspace
          </p>
          <h1 className={`${displayFont.className} mt-2 text-3xl leading-tight text-landing md:text-4xl`}>
            Drop your CV. See who&apos;s hiring you in 60 seconds.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
            No account. Paste text or drop a .md / .txt file to start. A PDF needs an AI CLI in{" "}
            <a href="/config" className="text-foreground underline-offset-2 hover:underline">
              Settings
            </a>{" "}
            first. The market scan is <span className="text-foreground">free</span>. You only spend tokens when you
            choose to score a role.
          </p>
          <div className="mt-7">
            <CvIngest />
          </div>
        </div>
      </section>
      {/* What comes after the CV, visible from the first second: the same checklist
          that keeps growing on Today once the CV is in. */}
      <div className="mt-6">
        <OnboardingProgress compact />
      </div>
    </div>
  );
}
