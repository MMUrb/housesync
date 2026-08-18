"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SettleExplainer } from "@/components/housemates/SettleExplainer";
import type { SettleMode } from "@/lib/types";

// House-wide settle up style. Like the house currency this applies to
// everyone, so no two housemates ever see different amounts, and changing it
// posts a system note in chat. Owner-only by design: it changes who pays whom.
//
// Switching has guards:
// - to simplified: blocked while itemised "paid" claims await a confirm
//   (their confirm buttons live in the itemised rows about to disappear).
// - to itemised: blocked while unabsorbed settlements exist. A rerouted
//   payment has no pairwise representation, so the itemised view can only be
//   trusted again once the house has fully settled (the sweep absorbs all).
// The props below only shape the UI; the database trigger in migration 0039
// enforces the same rules (plus owner-only) on the write itself, so a stale
// screen or a direct API call cannot bypass them.

/** The trigger raises short codes; turn them into sentences. */
function friendlyError(message: string): string {
  if (message.includes("settle_mode_owner_only")) return "Only the house admin can change this.";
  if (message.includes("settle_mode_pending_claims"))
    return "Confirm or undo the payment marks waiting on Housemates first.";
  if (message.includes("settle_mode_open_settlements"))
    return "Finish settling up first, then the house can switch back.";
  return message;
}

export function SettleModeForm({
  houseId,
  userId,
  isOwner,
  mode,
  planCount,
  pairCount,
  toSimplifiedBlocked,
  toItemisedBlocked,
}: {
  houseId: string;
  userId: string;
  isOwner: boolean;
  mode: SettleMode;
  planCount: number;
  pairCount: number;
  toSimplifiedBlocked: boolean;
  toItemisedBlocked: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHow, setShowHow] = useState(false);

  async function setMode(next: SettleMode) {
    if (next === mode || saving) return;
    setError(null);
    setSaving(true);
    const { error } = await supabase
      .from("houses")
      .update({ settle_mode: next })
      .eq("id", houseId);
    setSaving(false);
    if (error) {
      setError(friendlyError(error.message));
      // The guard state on screen was stale; pull the current one.
      router.refresh();
      return;
    }
    // Everyone's Housemates tab just changed shape, so say so in chat.
    void supabase
      .from("messages")
      .insert({
        house_id: houseId,
        user_id: userId,
        kind: "system",
        body:
          next === "simplified"
            ? "switched the house to simplified settle up. The Housemates tab now shows the fewest payments that clear everyone."
            : "switched the house back to itemised settle up. Every debt shows on its own again.",
      })
      .then(() => {});
    if (next === "simplified") setShowHow(true);
    router.refresh();
  }

  const options: {
    value: SettleMode;
    title: string;
    badge: string;
    body: string;
    blocked: boolean;
    blockedNote: string;
  }[] = [
    {
      value: "simplified",
      title: "Simplified",
      badge: pairCount > 0 ? `${planCount} payment${planCount === 1 ? "" : "s"}` : "fewest payments",
      body: "HouseSync nets everything off and shows each person the fewest transfers that clear them.",
      blocked: toSimplifiedBlocked,
      blockedNote: "Confirm or undo the payment marks waiting on Housemates first.",
    },
    {
      value: "itemised",
      title: "Itemised",
      badge: pairCount > 0 ? `${pairCount} payment${pairCount === 1 ? "" : "s"}` : "every debt on its own",
      body: "Every debt on its own, exactly as each expense created it.",
      blocked: toItemisedBlocked,
      blockedNote: "Finish settling up first, then the house can switch back.",
    },
  ];

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label="Settle up style"
        className="overflow-hidden rounded-xl border border-slate-200"
      >
        {options.map((opt, i) => {
          const active = mode === opt.value;
          const disabled = !isOwner || saving || (!active && opt.blocked);
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(opt.value)}
              disabled={disabled}
              className={`flex w-full items-start gap-3 p-3.5 text-left transition ${
                i > 0 ? "border-t border-slate-200" : ""
              } ${active ? "bg-brand-50" : "bg-white"} ${
                disabled && !active ? "opacity-60" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                  active ? "border-brand-600" : "border-slate-300"
                }`}
              >
                {active && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {opt.title}
                  {/* bg-mint-50 has a dark remap (translucent tint); text-mint-700
                      brightens in dark. Together they stay legible in both themes. */}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      opt.value === "simplified"
                        ? "bg-mint-50 text-mint-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {opt.badge}
                  </span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">{opt.body}</span>
                {!active && opt.blocked && isOwner && (
                  <span className="mt-1 block text-xs font-medium text-amber-600">
                    {opt.blockedNote}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        {isOwner
          ? "Applies to everyone in the house so no two people see different amounts. Changing it posts a note in chat."
          : "Only the house admin can change this."}{" "}
        <button
          type="button"
          onClick={() => setShowHow(true)}
          className="font-semibold text-brand-600 underline-offset-2 hover:underline"
        >
          How simplifying works
        </button>
      </p>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <SettleExplainer open={showHow} onClose={() => setShowHow(false)} />
    </div>
  );
}
