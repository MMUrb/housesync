"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/Select";
import { CURRENCIES } from "@/lib/currencies";

// Lets each person show a second, approximate amount in their own currency next
// to the house's totals (dashboard balances, etc). Purely personal: only this
// user sees it and it never changes what anyone actually owes. "Off" hides it.
export function DisplayCurrencyForm({
  userId,
  initial,
}: {
  userId: string;
  initial: string | null;
}) {
  const supabase = createClient();
  const [value, setValue] = useState(initial ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  async function save(next: string) {
    setValue(next);
    setState("saving");
    await supabase
      .from("account_settings")
      .upsert({ user_id: userId, display_currency: next || null }, { onConflict: "user_id" });
    setState("saved");
    setTimeout(() => setState("idle"), 1500);
  }

  const options = [
    { value: "", label: "Off (house currency only)" },
    ...CURRENCIES.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` })),
  ];

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">Also show amounts in</p>
        {state === "saving" && <span className="text-xs text-slate-400">Saving…</span>}
        {state === "saved" && <span className="text-xs text-mint-600">Saved</span>}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Shows a second amount in your own currency next to house totals. Only you see it, and rates
        are approximate and update daily.
      </p>
      <Select
        id="display-currency"
        ariaLabel="Display currency"
        value={value}
        onChange={save}
        options={options}
      />
    </div>
  );
}
