"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ResolveResult = {
  ok: boolean;
  stillOccurring?: boolean;
  lastSeenLabel?: string;
  resolved?: number | null;
  skipped?: number;
};

async function resolve(body: object): Promise<ResolveResult> {
  try {
    const res = await fetch("/api/admin/errors/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as ResolveResult;
  } catch {
    return { ok: false };
  }
}

/**
 * "Resolve all" — resolves only the errors that have stopped occurring; any
 * still happening within the recurrence window are kept (with a "resolve
 * anyway" override).
 */
export function ResolveAllButton({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [stillLive, setStillLive] = useState(0);
  if (count === 0) return null;

  async function go(force: boolean) {
    setBusy(true);
    const r = await resolve({ all: true, force });
    if (r.ok) {
      setStillLive(force ? 0 : (r.skipped ?? 0));
      router.refresh();
    }
    setBusy(false);
  }

  if (stillLive > 0) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-amber-600">{stillLive} still occurring</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => go(true)}
          className="font-medium text-brand-600 hover:underline disabled:opacity-50"
        >
          {busy ? "Resolving…" : "Resolve anyway"}
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => go(false)}
      title="Resolves only errors that have stopped occurring."
      className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
    >
      {busy ? "Checking…" : `Resolve all (${count})`}
    </button>
  );
}

/** Per-row resolve — verifies the error has stopped before resolving. */
export function ResolveOneButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [liveSince, setLiveSince] = useState<string | null>(null);

  async function go(force: boolean) {
    setBusy(true);
    const r = await resolve({ id, force });
    if (r.ok) {
      router.refresh();
      return;
    }
    if (r.stillOccurring) {
      setLiveSince(r.lastSeenLabel ?? "recently");
    }
    setBusy(false);
  }

  if (liveSince) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="whitespace-nowrap text-amber-600">Still live · {liveSince}</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => go(true)}
          className="font-medium text-slate-400 hover:text-brand-600 disabled:opacity-50"
        >
          {busy ? "…" : "Resolve anyway"}
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => go(false)}
      title="Resolves only if this error has stopped occurring."
      className="text-xs font-medium text-slate-400 hover:text-brand-600 disabled:opacity-50"
    >
      {busy ? "Checking…" : "Resolve"}
    </button>
  );
}
