import Link from "next/link";
import { Info } from "lucide-react";

/** Shown in place of a feature that needs the user's own computer (a visible browser, an OS scheduler). */
export function HostedUnavailable({ title, children, href, cta }: { title: string; children: React.ReactNode; href?: string; cta?: string }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="rounded-2xl border border-border bg-surface p-8">
        <Info className="size-6 text-brand-text" />
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-landing">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
        {href && cta && (
          <Link href={href} className="mt-5 inline-flex items-center rounded-full bg-inverse px-5 py-2 text-sm font-medium text-inverse-foreground transition-colors hover:bg-inverse/80">
            {cta}
          </Link>
        )}
      </div>
    </div>
  );
}
