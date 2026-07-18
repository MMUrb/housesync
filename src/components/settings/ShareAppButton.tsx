"use client";

import { useState } from "react";

const SHARE_URL = "https://housesync.co.uk";
const SHARE_TEXT =
  "HouseSync makes splitting bills, chores and rent with your housemates easy. Give it a go:";

// Native share sheet on phones (Web Share API), copy-to-clipboard fallback on
// desktop. Same one component works on iOS, Android and the website.
export function ShareAppButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ title: "HouseSync", text: SHARE_TEXT, url: SHARE_URL });
      } catch {
        /* user cancelled the share sheet — nothing to do */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="card flex w-full items-center justify-between p-4 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
    >
      <div>
        <p className="text-sm font-medium text-slate-800">Share HouseSync</p>
        <p className="text-xs text-slate-500">
          {copied ? "Link copied to clipboard" : "Invite friends to sort their house out too"}
        </p>
      </div>
      <span className="shrink-0 text-slate-300">↗</span>
    </button>
  );
}
