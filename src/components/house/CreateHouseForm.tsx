"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setActiveHouse } from "@/lib/activeHouse";
import { CURRENCIES } from "@/lib/constants";
import { InviteBox } from "@/components/house/InviteBox";
import type { House } from "@/lib/types";

export function CreateHouseForm() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [rentDueDay, setRentDueDay] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<House | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("create_house", {
        p_name: name.trim(),
        p_currency: currency,
        p_rent_due_day: rentDueDay ? Number(rentDueDay) : null,
        p_address_nickname: nickname.trim() || null,
      });
      if (error) throw error;
      const house = (Array.isArray(data) ? data[0] : data) as House;
      setActiveHouse(house.id);
      setCreated(house);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the house.");
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div className="card p-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-mint-100 text-2xl">
          🎉
        </div>
        <h2 className="mt-3 text-xl font-bold text-slate-900">{created.name} is ready!</h2>
        <p className="mt-1 text-sm text-slate-600">
          Share this link with your housemates so they can join.
        </p>
        <div className="mt-5 text-left">
          <InviteBox code={created.invite_code} houseName={created.name} />
        </div>
        <button
          onClick={() => {
            router.push("/dashboard");
            router.refresh();
          }}
          className="btn-primary btn-block mt-5"
        >
          Continue to dashboard
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="house-name">
          House name
        </label>
        <input
          id="house-name"
          className="input"
          placeholder="e.g. Manchester Flat"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="currency">
            Currency
          </label>
          <select
            id="currency"
            className="input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
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
            placeholder="e.g. 1"
            value={rentDueDay}
            onChange={(e) => setRentDueDay(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="nickname">
          Address nickname <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="nickname"
          className="input"
          placeholder="e.g. The Blue House"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">No need for your full address.</p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary btn-block">
        {loading ? "Creating…" : "Create house"}
      </button>
    </form>
  );
}
