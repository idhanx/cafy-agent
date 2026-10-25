"use client";

import { useEffect, useState } from "react";
import {
  Check,
  KeyRound,
  Terminal,
  Loader2,
  CircleDashed,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CadenceSettings } from "@/components/followups/cadence-settings";
import { AiProviderPanel } from "@/components/ai-provider-panel";
import { persistCliId, readSavedCliId } from "@/lib/saved-cli";
import { keepIfInstalled, pickDefaultInstalled } from "@/lib/cli-pick.mjs";

type Cli = {
  id: string;
  name: string;
  run: string;
  url: string;
  installed: boolean;
  path: string | null;
};

type Mode = "cli" | "key";

const STORAGE_KEY = "career-ops:config";

export function ConfigForm() {
  const [mode, setMode] = useState<Mode>("cli");
  const [clis, setClis] = useState<Cli[] | null>(null);
  const [cliId, setCliId] = useState<string>("");
  const [hosted, setHosted] = useState(false);
  const [reload, setReload] = useState(0);
  const [logos, setLogos] = useState(true);
  const [saved, setSaved] = useState(false);

  // Load saved prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (v.mode === "cli" || v.mode === "key") setMode(v.mode);
        if (v.cliId) setCliId(v.cliId);
        if (typeof v.logos === "boolean") setLogos(v.logos);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Detect installed CLIs
  useEffect(() => {
    fetch("/api/clis")
      .then((r) => r.json())
      .then((d) => {
        const list: Cli[] = d.clis ?? [];
        setClis(list);
        setHosted(d.hosted === true);
        // Hosted: the built-in engine is the only engine. Locally, keep the
        // user's tool unless they never chose one and none is installed.
        if (d.hosted === true) setMode("key");
        // Highlight + persist the default installed CLI when Config was never
        // saved. Highlight-only looks configured while jobs still read empty
        // localStorage -- so whatever is rendered as selected must be written.
        // This applies at ANY installed count: restricting it to a SOLE install
        // left every multi-CLI machine (claude + codex, say) in exactly the
        // broken state the highlight was meant to avoid.
        setCliId((prev) => {
          // A restored id whose CLI is no longer installed must not stick: it
          // would stay selected and save() would write it straight back, so
          // "open Config and click Save config" could never clear it (#4012).
          if (keepIfInstalled(prev, list)) return prev;
          const auto = pickDefaultInstalled(list, typeof d.remembered === "string" ? d.remembered : null);
          if (!auto) return "";
          if (!readSavedCliId()) persistCliId(auto);
          return auto;
        });
      })
      .catch(() => setClis([]));
  }, [reload]);

  function save() {
    // The AI key is never kept in the browser: it is stored server-side by the
    // AI provider panel. Only the engine choice and display prefs live here.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, cliId, logos }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const installed = clis?.filter((c) => c.installed) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl tracking-tight text-landing">Settings</h1>
      <p className="mt-1 text-sm text-muted">
        {hosted
          ? "Connect your AI provider to switch on every AI feature."
          : "Run Cafy Agent on your own AI, right on your computer. Your CV and data never leave your machine."}
      </p>

      {/* Engine mode */}
      <label className="mt-8 mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        AI Engine
      </label>
      <div className={cn("grid gap-2", hosted ? "sm:grid-cols-1" : "sm:grid-cols-2")}>
        <ModeCard
          active={mode === "key"}
          onClick={() => setMode("key")}
          icon={KeyRound}
          title="Connect an AI key"
          hint={hosted ? "OpenRouter" : "Works anywhere — recommended"}
        />
        {!hosted && (
          <ModeCard
            active={mode === "cli"}
            onClick={() => setMode("cli")}
            icon={Terminal}
            title="Use an AI tool you have"
            hint="Claude Code, Codex, OpenCode…"
          />
        )}
      </div>

      <div className="mt-6">
        {mode === "key" && (
          <AiProviderPanel
            onConnected={() => {
              persistCliId("openrouter");
              setCliId("openrouter");
              setReload((n) => n + 1);
            }}
          />
        )}

        {mode === "cli" && !hosted && (
          <div>
            <p className="mb-1 text-sm text-muted">
              Cafy Agent uses an AI tool you already have — signed in, your own usage, nothing to paste.
            </p>
            <p className="mb-3 text-xs text-faint">Works with Claude Code, Codex, OpenCode and more — free ones work great.</p>
            {clis === null ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" /> Checking what&apos;s on your computer…
              </div>
            ) : installed.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted">
                No AI tool yet? Free options like <span className="text-foreground">OpenCode</span> with Qwen or GLM work great.{" "}
                <a href="https://career-ops.org/docs/free-ai-engine" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-text hover:underline">
                  Get one free <ExternalLink className="size-3" />
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {clis.map((c) => {
                  const selected = c.id === cliId;
                  const rowClassName = cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                    selected
                      ? "border-brand/50 bg-brand-soft"
                      : c.installed
                        ? "border-border bg-surface"
                        : "border-border/60 bg-surface/20",
                  );

                  if (c.installed) {
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCliId(c.id)}
                        aria-pressed={selected}
                        className={cn(rowClassName, "w-full cursor-pointer text-left")}
                      >
                        <Check className="size-4 shrink-0 text-emerald-400" />
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className={cn("font-medium", selected ? "text-foreground" : "")}>
                            {c.name}
                          </span>
                          <span className="font-mono text-xs text-faint">{c.run}</span>
                        </span>
                        <span className="hidden max-w-[40%] shrink-0 truncate text-xs text-faint sm:block">
                          {c.path}
                        </span>
                      </button>
                    );
                  }

                  return (
                    <div
                      key={c.id}
                      className={rowClassName}
                    >
                      <CircleDashed className="size-4 shrink-0 text-faint" />
                      <button
                        type="button"
                        disabled
                        className="flex flex-1 items-center gap-2 text-left max-sm:min-h-[44px] cursor-default"
                      >
                        <span className="font-medium text-muted">
                          {c.name}
                        </span>
                        <span className="font-mono text-xs text-faint">{c.run}</span>
                      </button>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center justify-center gap-1 text-xs text-brand-text hover:underline max-sm:min-h-[44px]"
                      >
                        Install <ExternalLink className="size-3" />
                      </a>
                    </div>
                  );
                })}
                {installed.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-xs text-muted">
                    No supported CLI found on your PATH. Install one (e.g. Claude Code, Gemini CLI, OpenCode) to get started.
                  </p>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-faint">
                  Best on <span className="text-muted">Claude Code</span> (live progress, the agentic apply + AI search,
                  reliable evaluation persistence). Other CLIs work for the core flows with reduced features.
                </p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Appearance / privacy */}
      <label className="mt-8 mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        Appearance
      </label>
      <button
        type="button"
        onClick={() => setLogos((v) => !v)}
        className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">Company logos</span>
          <span className="mt-0.5 block text-xs text-faint">
            Show each company&apos;s real logo. Fetched once through your local server and cached on
            disk — only the employer domain is sent to a third party. Off = colored monograms only.
          </span>
        </span>
        <span
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            logos ? "bg-brand" : "bg-surface-hover",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
              logos ? "translate-x-[1.375rem]" : "translate-x-0.5",
            )}
          />
        </span>
      </button>

      <CadenceSettings />

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-inverse px-5 py-2 text-sm font-medium text-inverse-foreground transition-colors hover:bg-inverse/80 max-sm:min-h-[44px]"
        >
          {saved ? <Check className="size-4" /> : null}
          {saved ? "Saved" : "Save config"}
        </button>
        <span className="text-xs text-faint">{hosted ? "Your data is stored privately on this deployment." : "Local-first"}</span>
      </div>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  hint,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border px-4 py-3 text-left transition-colors",
        disabled
          ? "cursor-not-allowed border-border bg-surface opacity-55"
          : active
            ? "border-brand/50 bg-brand-soft"
            : "border-border bg-surface hover:bg-surface-hover",
      )}
    >
      <Icon className={cn("size-4", active && !disabled ? "text-brand-text" : "text-muted")} />
      <span className="text-sm font-medium text-foreground">{title}</span>
      <span className="text-xs text-faint">{hint}</span>
    </button>
  );
}
