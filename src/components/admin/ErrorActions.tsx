"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function resolve(body: object) {
  const res = await fetch("/api/admin/errors/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

/** "Resolve all" button shown above the list. */
export function ResolveAllButton({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (count === 0) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        if (await resolve({ all: true })) router.refresh();
        else setBusy(false);
      }}
      className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
    >
      {busy ? "Resolving…" : `Resolve all (${count})`}
    </button>
  );
}

/** Per-row resolve link. */
export function ResolveOneButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        if (await resolve({ id })) router.refresh();
        else setBusy(false);
      }}
      className="text-xs font-medium text-slate-400 hover:text-brand-600 disabled:opacity-50"
    >
      {busy ? "…" : "Resolve"}
    </button>
  );
}
