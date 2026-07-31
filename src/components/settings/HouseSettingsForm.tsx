"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CURRENCIES, currencyName } from "@/lib/currencies";
import { Select } from "@/components/Select";
import type { House } from "@/lib/types";

/** "1st", "2nd", "23rd"... for the rent-day notice. */
function ordinal(n: number): string {
  const r10 = n % 10;
  const r100 = n % 100;
  if (r10 === 1 && r100 !== 11) return `${n}st`;
  if (r10 === 2 && r100 !== 12) return `${n}nd`;
  if (r10 === 3 && r100 !== 13) return `${n}rd`;
  return `${n}th`;
}

export function HouseSettingsForm({
  house,
  userId,
  bare = false,
}: {
  house: House;
  userId: string;
  /** Render without the card chrome (when shown inside a settings panel). */
  bare?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(house.name);
  const [currency, setCurrency] = useState(house.currency);
  const [rentDay, setRentDay] = useState(house.rent_due_day ? String(house.rent_due_day) : "");
  const [nickname, setNickname] = useState(house.address_nickname ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Plain-English list of what actually changed, for the chat notice. */
  function describeChanges(): string[] {
    const out: string[] = [];
    const newName = name.trim();
    const newDay = rentDay ? Number(rentDay) : null;
    const newNick = nickname.trim() || null;
    if (newName && newName !== house.name) out.push(`renamed the house to “${newName}”`);
    if (currency !== house.currency)
      out.push(`changed the house currency to ${currency} (${currencyName(currency)})`);
    if (newDay !== (house.rent_due_day ?? null))
      out.push(newDay ? `set rent day to the ${ordinal(newDay)}` : "removed the rent day");
    if (newNick !== (house.address_nickname ?? null))
      out.push(newNick ? `set the address nickname to “${newNick}”` : "removed the address nickname");
    return out;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    const changes = describeChanges();
    const { error } = await supabase
      .from("houses")
      .update({
        name: name.trim(),
        currency,
        rent_due_day: rentDay ? Number(rentDay) : null,
        address_nickname: nickname.trim() || null,
      })
      .eq("id", house.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }

    // Tell the house what changed, in the chat (best-effort — never block the
    // save on it). Currency especially: it silently restyles everyone's money.
    if (changes.length > 0) {
      void supabase
        .from("messages")
        .insert({
          house_id: house.id,
          user_id: userId,
          kind: "system",
          body: `${changes.join(", and ")}.`,
        })
        .then(() => {});
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <form onSubmit={save} className={bare ? "space-y-4" : "card space-y-4 p-5"}>
      <div>
        <label className="label" htmlFor="house-name">
          House name
        </label>
        <input
          id="house-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="currency">
            Currency
          </label>
          <Select
            id="currency"
            ariaLabel="Currency"
            value={currency}
            onChange={setCurrency}
            options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="rent-day">
            Rent due day
          </label>
          <input
            id="rent-day"
            type="number"
            min={1}
            max={31}
            className="input"
            value={rentDay}
            onChange={(e) => setRentDay(e.target.value)}
          />
        </div>
      </div>
      <p className="-mt-1 text-xs text-slate-500">
        Currency applies to the whole house. Existing amounts aren&apos;t converted, they&apos;re
        just shown in the new currency.
      </p>
      <div>
        <label className="label" htmlFor="nickname">
          Address nickname
        </label>
        <input
          id="nickname"
          className="input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
      </button>
    </form>
  );
}
