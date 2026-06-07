"use client";

import { useState } from "react";
import { getSiteUrl } from "@/lib/env";

export function inviteUrl(code: string) {
  return `${getSiteUrl()}/house/join/${code}`;
}

export function InviteBox({ code, houseName }: { code: string; houseName?: string }) {
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(code);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my house on HouseSync",
          text: houseName ? `Join "${houseName}" on HouseSync` : "Join my house on HouseSync",
          url,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-700 outline-none"
        />
        <button type="button" onClick={copy} className="btn-primary shrink-0 px-3 py-2">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <button type="button" onClick={share} className="btn-ghost mt-2 w-full">
        Share invite link
      </button>
    </div>
  );
}
