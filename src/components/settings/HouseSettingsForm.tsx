"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CURRENCIES } from "@/lib/currencies";
import { HOUSE_NAME_MAX } from "@/lib/constants";
import { Select } from "@/components/Select";
import type { House } from "@/lib/types";

export function HouseSettingsForm({
  house,
  bare = false,
}: {
  house: House;
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // The DB now enforces a 1-30 char name; catch an empty one here so the
    // user gets a sentence instead of a raw Postgres constraint error.
    if (!name.trim()) {
      setError("Give your house a name.");
      return;
    }
    setSaving(true);
    setSaved(false);
    // The chat note saying what changed ("renamed the house to ...") is
    // written by the database itself (migration 0048), so nobody can fake one.
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
      setError(
        error.message.includes("houses_name_length")
          ? "House names need to be 1 to 30 characters."
          : error.message,
      );
      return;
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
          maxLength={HOUSE_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
        />
        {name.length >= HOUSE_NAME_MAX - 5 && (
          <p className="mt-1 text-right text-[11px] text-slate-400">
            {name.length}/{HOUSE_NAME_MAX}
          </p>
        )}
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
            inputMode="numeric"
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
