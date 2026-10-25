"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, KeyRound } from "lucide-react";
import { cn } from "@/lib/cn";

type Status = {
  hosted: boolean;
  connected: boolean;
  source: "env" | "saved" | "none";
  locked: boolean;
  maskedKey: string;
  model: string;
  defaultModel: string;
  canSave: boolean;
};

/** Connect the built-in AI engine: one OpenRouter key, nothing to install. */
export function AiProviderPanel({ onConnected }: { onConnected: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s: Status = await fetch("/api/ai-provider").then((r) => r.json());
      setStatus(s);
      setModel((m) => m || s.model);
    } catch {
      setError("Couldn't read the AI provider status. Refresh and try again.");
    }
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/ai-provider/models").then((r) => r.json()).then((d) => setModels(d.models ?? [])).catch(() => {});
  }, [load]);

  async function submit(body: { apiKey?: string; model?: string }, done: string) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const res = await fetch("/api/ai-provider", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't save.");
      } else {
        setStatus(data);
        setApiKey("");
        setEditing(false);
        setNote(done);
        if (data.connected) onConnected();
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      setStatus(await fetch("/api/ai-provider", { method: "DELETE" }).then((r) => r.json()));
      setNote("Key removed.");
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="size-4 animate-spin" /> Checking your AI connection…
      </div>
    );
  }

  const showKeyField = !status.connected || editing;
  const fromEnv = status.source === "env";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Cafy Agent&apos;s AI features run through <span className="text-foreground">OpenRouter</span> — one key gives access to Claude, GPT, Gemini and more. Nothing to install.
      </p>

      {status.connected && (
        <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm">
          <Check className="size-4 shrink-0 text-brand-text" />
          <span className="font-medium text-foreground">Connected</span>
          <span className="truncate font-mono text-xs text-muted">
            {fromEnv ? "using the server's OPENROUTER_API_KEY" : status.maskedKey}
          </span>
          {!fromEnv && (
            <span className="ml-auto flex shrink-0 gap-3 text-xs">
              <button type="button" onClick={() => setEditing((v) => !v)} className="text-brand-text hover:underline">Change key</button>
              <button type="button" onClick={disconnect} disabled={busy} className="text-muted hover:text-foreground hover:underline">Disconnect</button>
            </span>
          )}
        </div>
      )}

      {status.locked && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-foreground">
          A key was saved here before, but this server can&apos;t unlock it (its secret changed). Paste the key again.
        </p>
      )}

      {showKeyField && !fromEnv && (
        status.canSave ? (
          <div>
            <label htmlFor="ai-key" className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">OpenRouter API key</label>
            <div className="flex gap-2">
              <input
                id="ai-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-…"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 font-mono text-sm outline-none transition-colors placeholder:text-faint focus:border-brand/50"
              />
              <button
                type="button"
                disabled={busy || !apiKey.trim()}
                onClick={() => submit({ apiKey, model: model || undefined }, "Connected — your key checked out.")}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-inverse px-5 py-2 text-sm font-medium text-inverse-foreground transition-colors hover:bg-inverse/80 disabled:opacity-50 max-sm:min-h-[44px]"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                Connect
              </button>
            </div>
            <p className="mt-2 text-xs text-faint">
              Checked with OpenRouter, then stored encrypted on the server — never in your browser.{" "}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-text hover:underline">
                Get a key <ExternalLink className="size-3" />
              </a>
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted">
            This server isn&apos;t set up to store keys yet. Ask the administrator to set <code className="font-mono text-foreground">OPENROUTER_API_KEY</code> in the deployment&apos;s environment variables.
          </p>
        )
      )}

      {status.connected && (
        <div>
          <label htmlFor="ai-model" className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Model</label>
          <div className="flex gap-2">
            <input
              id="ai-model"
              list="ai-models"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={status.defaultModel}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 font-mono text-sm outline-none transition-colors placeholder:text-faint focus:border-brand/50"
            />
            <datalist id="ai-models">{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</datalist>
            <button
              type="button"
              disabled={busy || !model.trim() || model.trim() === status.model}
              onClick={() => submit({ model }, "Model updated.")}
              className={cn("shrink-0 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-50 max-sm:min-h-[44px]")}
            >
              Use model
            </button>
          </div>
          <p className="mt-2 text-xs text-faint">Tool-capable models only. Claude Sonnet is the recommended default for CV and evaluation work.</p>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      {note && !error && <p role="status" className="text-sm text-brand-text">{note}</p>}
    </div>
  );
}
