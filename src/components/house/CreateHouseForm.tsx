"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setActiveHouse } from "@/lib/activeHouse";
import { setLeaveGuard } from "@/lib/leaveGuard";
import { HOUSE_NAME_MAX } from "@/lib/constants";
import { formatMoney, ordinalDay } from "@/lib/format";
import { nextDueForDay } from "@/lib/recurrence";
import { JoinByCode } from "@/components/house/JoinByCode";
import { RENT_POPUP_KEY } from "@/components/house/RentSetupPopup";
import type { House } from "@/lib/types";

/**
 * Two-step set-up: name the place, then (optionally) sort the rent. Currency
 * and the address nickname are silent defaults (GBP / none) changeable in
 * Settings, so the house exists after one real question. If they add a rent
 * amount, it lands as a normal monthly bill paid by them: splitting it stays
 * a thing the payer does on purpose once housemates join, never automatic.
 */
export function CreateHouseForm() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [rentDay, setRentDay] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const trimmed = name.trim();
  const dayNum = rentDay.trim() ? Number(rentDay) : null;
  const dayValid = dayNum !== null && Number.isInteger(dayNum) && dayNum >= 1 && dayNum <= 31;
  const amountNum = Math.round((Number(rentAmount) || 0) * 100) / 100;

  // Warn before leaving once they've started (cleared just before navigating).
  useEffect(() => {
    setLeaveGuard(Boolean(trimmed || rentDay || rentAmount));
    return () => setLeaveGuard(false);
  }, [trimmed, rentDay, rentAmount]);

  function toStep2(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed) return;
    setError(null);
    setStep(2);
  }

  async function create(withRent: boolean) {
    setError(null);

    // A number input holding something unparseable ("-", ".", a partial
    // "1e") reports its value as "" while the user can still SEE text in
    // the box; without this check Done would silently treat it as empty.
    if (withRent && dayRef.current?.validity.badInput) {
      setError("The rent day needs to be a whole number from 1 to 31.");
      return;
    }
    if (withRent && amountRef.current?.validity.badInput) {
      setError("Enter a rent amount above zero, or leave it empty.");
      return;
    }
    if (withRent && rentDay.trim() && !dayValid) {
      setError("The rent day needs to be a whole number from 1 to 31.");
      return;
    }
    if (withRent && rentAmount.trim() && !(amountNum > 0)) {
      setError("Enter a rent amount above zero, or leave it empty.");
      return;
    }
    if (withRent && amountNum > 0 && !dayValid) {
      setError("Add the day of the month (1 to 31) so we know when rent is due.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("create_house", {
        p_name: trimmed,
        p_currency: "GBP",
        p_rent_due_day: withRent && dayValid ? dayNum : null,
        p_address_nickname: null,
      });
      if (error) throw error;
      const house = (Array.isArray(data) ? data[0] : data) as House;
      setActiveHouse(house.id);

      // The rent bill: an ordinary recurring bill paid by the creator. It only
      // ever splits when the payer requests it, so "down as yours for now"
      // stays true until they act. Best-effort: a hiccup here must not strand
      // a house that already exists — they can add the bill from Money later.
      if (withRent && dayValid && amountNum > 0) {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error("No session");
          const { error: billErr } = await supabase.from("recurring_bills").insert({
            house_id: house.id,
            title: "Rent",
            amount: amountNum,
            category: "rent",
            frequency: "monthly",
            due_day: dayNum,
            next_due_date: nextDueForDay(dayNum!),
            paid_by: user.id,
            split_type: "equal",
            reminder_enabled: true,
            active: true,
            created_by: user.id,
          });
          if (billErr) throw billErr;
          await supabase.from("activity").insert({
            house_id: house.id,
            user_id: user.id,
            type: "bill_added",
            message: `added a recurring bill: “Rent” (${formatMoney(amountNum, "GBP")} monthly)`,
          });
          try {
            sessionStorage.setItem(
              RENT_POPUP_KEY,
              JSON.stringify({ amount: amountNum, day: dayNum, currency: "GBP" }),
            );
          } catch {
            // No pop-up then; the bill itself is in.
          }
        } catch (billErr) {
          console.error("Rent bill was not created:", billErr);
        }
      }

      setLeaveGuard(false);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the house.");
      setLoading(false);
    }
  }

  const dots = (
    <div className="flex justify-end gap-1.5" aria-hidden="true">
      <span
        className={`h-1.5 rounded-full transition-all ${step === 1 ? "w-5 bg-brand-600" : "w-1.5 bg-slate-200 dark:bg-white/15"}`}
      />
      <span
        className={`h-1.5 rounded-full transition-all ${step === 2 ? "w-5 bg-brand-600" : "w-1.5 bg-slate-200 dark:bg-white/15"}`}
      />
    </div>
  );

  if (step === 2) {
    return (
      <div>
        {dots}
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setError(null);
            setStep(1);
          }}
          className="mt-4 text-xs font-medium text-slate-400 hover:text-slate-600 disabled:opacity-50"
        >
          ← Back
        </button>
        <h1 className="mt-4 text-[27px] font-extrabold leading-tight tracking-tight text-slate-900">
          Sort the rent now?
        </h1>
        <p className="mt-2 text-sm text-slate-500">Both optional, both editable later.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create(true);
          }}
        >
          <label className="label mt-6 block" htmlFor="rent-day">
            What day of the month is rent due?{" "}
            <span className="font-normal text-slate-400">(1 to 31)</span>
          </label>
          <input
            id="rent-day"
            ref={dayRef}
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            step={1}
            className="input w-28 text-lg font-bold"
            placeholder="1"
            value={rentDay}
            onChange={(e) => setRentDay(e.target.value)}
            autoFocus
          />

          <label className="label mt-5 block" htmlFor="rent-amount">
            How much is rent each month?{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              £
            </span>
            <input
              id="rent-amount"
              ref={amountRef}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="input pl-7 text-lg font-bold"
              placeholder="0.00"
              value={rentAmount}
              onChange={(e) => setRentAmount(e.target.value)}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Add the amount and rent goes straight into your Money tab as a monthly payment
            {dayValid ? ` on the ${ordinalDay(dayNum!)}` : ""}. Splitting it stays in your hands
            once housemates join.
          </p>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary btn-block mt-6">
            {loading ? "Setting up…" : "Done →"}
          </button>
          <button
            type="button"
            onClick={() => void create(false)}
            disabled={loading}
            className="mx-auto mt-4 block text-sm font-semibold text-slate-400 hover:text-slate-600"
          >
            Skip for now
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      {dots}
      <h1 className="mt-8 text-[27px] font-extrabold leading-tight tracking-tight text-slate-900">
        What do you call your place?
      </h1>
      <p className="mt-2 text-sm text-slate-500">Whatever the group chat calls it works.</p>

      <form onSubmit={toStep2}>
        <input
          id="house-name"
          aria-label="House name"
          className="input mt-6 rounded-2xl px-4 py-4 text-xl font-bold"
          placeholder="House name"
          value={name}
          maxLength={HOUSE_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        {name.length >= HOUSE_NAME_MAX - 5 && (
          <p className="mt-1 text-right text-[11px] text-slate-400">
            {name.length}/{HOUSE_NAME_MAX}
          </p>
        )}

        <button type="submit" disabled={!trimmed} className="btn-primary btn-block mt-6">
          <span className="max-w-[16rem] truncate">
            {trimmed ? `Create ${trimmed}` : "Create your house"}
          </span>{" "}
          →
        </button>
        <p className="mt-4 text-center text-xs leading-relaxed text-slate-400">
          Pounds (£) and everything else are set for you.
          <br />
          Change any of it later in Settings.
        </p>
      </form>

      <div className="mt-9">
        {showJoin ? (
          <div className="space-y-3">
            <p className="text-center text-sm font-semibold text-slate-700">
              Join an existing house
            </p>
            <JoinByCode />
            <button
              type="button"
              onClick={() => setShowJoin(false)}
              className="mx-auto block text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              Actually, I&apos;m creating a new house
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowJoin(true)}
            className="mx-auto block text-sm font-bold text-brand-600 hover:underline"
          >
            Got an invite code instead?
          </button>
        )}
      </div>
    </div>
  );
}
