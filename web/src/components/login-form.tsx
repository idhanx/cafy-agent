"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CoMark } from "@/components/co-mark";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = new URLSearchParams(window.location.search).get("next") ?? "/";
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, next }) });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't sign in.");
        setBusy(false);
        return;
      }
      window.location.assign(data.next || "/");
    } catch {
      setError("Couldn't reach the server. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
      <div className="flex items-center gap-3">
        <CoMark size={36} />
        <h1 className="text-xl font-semibold tracking-tight text-landing">Cafy Agent</h1>
      </div>
      <p className="mt-3 text-sm text-muted">Enter the password you were given to continue.</p>
      <label htmlFor="pw" className="mt-6 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Password</label>
      <input
        id="pw"
        type="password"
        autoFocus
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand/50"
      />
      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={busy || !password}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-inverse px-5 py-2.5 text-sm font-medium text-inverse-foreground transition-colors hover:bg-inverse/80 disabled:opacity-50"
      >
        {busy && <Loader2 className="size-4 animate-spin" />} Sign in
      </button>
    </form>
  );
}
