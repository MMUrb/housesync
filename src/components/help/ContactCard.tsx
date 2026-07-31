"use client";

import { useState } from "react";

const EMAIL = "hello@housesync.co.uk";
const INSTAGRAM_URL = "https://www.instagram.com/housesync.co.uk/";

// "Still need a hand?" card on the Help page. The old single mailto button
// silently did nothing on desktops with no mail app — now the email action
// ALSO copies the address (with visible feedback) so nobody is stranded, and
// Instagram DMs are offered as a second route that always works.
export function ContactCard() {
  const [copied, setCopied] = useState(false);

  function onEmailClick() {
    // Best-effort copy alongside the mailto attempt: if no mail client opens,
    // the user is still holding the address.
    void navigator.clipboard
      ?.writeText(EMAIL)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      })
      .catch(() => {});
  }

  return (
    <div className="card p-4">
      <p className="text-sm font-medium text-slate-800">Still need a hand?</p>
      <p className="text-xs text-slate-500">
        {copied ? (
          <span className="font-medium text-mint-600">Email address copied: {EMAIL}</span>
        ) : (
          "Message us and we'll get back to you."
        )}
      </p>
      <div className="mt-3 flex gap-2">
        <a
          href={`mailto:${EMAIL}?subject=HouseSync%20help`}
          onClick={onEmailClick}
          className="btn-secondary flex flex-1 items-center justify-center gap-2 px-3 py-2 text-sm"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
            <path d="m3.5 7 8.5 6 8.5-6" />
          </svg>
          Email us
        </a>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary flex flex-1 items-center justify-center gap-2 px-3 py-2 text-sm"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="3.8" />
            <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
          </svg>
          Instagram
        </a>
      </div>
    </div>
  );
}
