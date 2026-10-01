"use client";

import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { lockScroll, onHardwareBack } from "@/lib/launchPrompts";

// The message a house-less user sends whoever set up their house. Only that
// person (the admin) can make invite links since 0046, from the House tab.
const ASK_TEXT =
  "Can you invite me to our house on HouseSync? Open the app, go to the House tab, tap Create invite link and send it to me. It only works for 10 minutes, so I'll open it straight away.";

// Per session: "not now" (tapping outside, Back, Escape) asks again next time
// the app opens. Per device and per account: "I'm setting up a new house".
const SESSION_KEY = "hs_join_prompt_later";
const founderKey = (userId: string) => `hs_join_prompt_founder::${userId}`;

/**
 * Shown on the create-house page to someone who is in no house at all: most
 * of them were told about HouseSync by housemates who already use it, and
 * should join that house rather than start a second one. One tap asks the
 * admin for an invite link, one opens the paste box, one carries on setting
 * up a new house.
 */
export function JoinHousePrompt({
  userId,
  onHaveLink,
}: {
  userId: string;
  onHaveLink: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Focus moves into the pop-up, off the house-name box behind it (which
  // focuses itself on load and could raise the keyboard under the pop-up).
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(founderKey(userId)) === "1") return;
      if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    } catch {
      /* storage blocked: show it, it just can't remember */
    }
    setOpen(true);
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const unlock = lockScroll();
    const offBack = onHardwareBack(() => later());
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && later();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      offBack();
      unlock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function later() {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* fine */
    }
    setOpen(false);
  }

  function founder() {
    try {
      localStorage.setItem(founderKey(userId), "1");
    } catch {
      /* fine */
    }
    setOpen(false);
  }

  function haveLink() {
    later();
    onHaveLink();
  }

  // The phone's share sheet in the apps and where the browser has one,
  // otherwise the message goes on the clipboard (said on the button itself:
  // this page has no toast host).
  async function ask() {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Share } = await import("@capacitor/share");
        await Share.share({ text: ASK_TEXT, dialogTitle: "Ask for an invite link" });
        later();
      } catch {
        /* cancelled: stay open */
      }
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: ASK_TEXT });
        later();
        return;
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "NotAllowedError")) return;
      }
    }
    try {
      await navigator.clipboard.writeText(ASK_TEXT);
      setCopied(true);
    } catch {
      /* nothing more we can do; the text stays on screen */
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6"
      onClick={later}
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-prompt-title"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="card w-full max-w-sm p-6 text-center outline-none"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-3xl">
          🏠
        </div>
        <h2 id="join-prompt-title" className="mt-3 text-lg font-bold text-slate-900">
          You&rsquo;re not in a house yet
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Bills, chores and the house chat all live inside a house. If your housemates already use
          HouseSync, ask the person who set it up for an invite link. It works for 10 minutes.
        </p>
        <button type="button" onClick={() => void ask()} className="btn-primary btn-block mt-5">
          {copied ? "Message copied. Paste it to them" : "Ask for an invite link"}
        </button>
        <button type="button" onClick={haveLink} className="btn-secondary btn-block mt-2.5">
          I&apos;ve got a link
        </button>
        <button
          type="button"
          onClick={founder}
          className="mx-auto mt-4 block text-sm font-semibold text-slate-400 hover:text-slate-600"
        >
          I&apos;m setting up a new house
        </button>
      </div>
    </div>
  );
}
