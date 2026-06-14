"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MethodKey = "monzo" | "paypal" | "revolut" | "bank";

const METHODS: {
  key: MethodKey;
  label: string;
  column: "monzo" | "paypal" | "revolut" | "bank";
  placeholder: string;
  hint: string;
}[] = [
  {
    key: "monzo",
    label: "Monzo",
    column: "monzo",
    placeholder: "monzo.me username",
    hint: "Your monzo.me username, housemates get a one-tap Pay button.",
  },
  {
    key: "paypal",
    label: "PayPal",
    column: "paypal",
    placeholder: "paypal.me username",
    hint: "Your paypal.me username.",
  },
  {
    key: "revolut",
    label: "Revolut",
    column: "revolut",
    placeholder: "revolut.me tag",
    hint: "Your revolut.me tag.",
  },
  {
    key: "bank",
    label: "Bank transfer",
    column: "bank",
    placeholder: "Name · 12-34-56 · 12345678",
    hint: "Name, sort code and account number for a manual bank transfer.",
  },
];

function parseBank(s: string): { name: string; sort: string; account: string } {
  const p = s.split("·").map((x) => x.trim());
  return { name: p[0] ?? "", sort: p[1] ?? "", account: p[2] ?? "" };
}

function formatSort(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 6);
  return d.replace(/(\d{2})(?=\d)/g, "$1-");
}

function formatAccount(v: string): string {
  return v.replace(/\D/g, "").slice(0, 8);
}

export function PaymentDetailsForm({
  userId,
  initialMonzo,
  initialPaypal,
  initialRevolut,
  initialBank,
  initialShare,
}: {
  userId: string;
  initialMonzo: string;
  initialPaypal: string;
  initialRevolut: string;
  initialBank: string;
  initialShare: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [values, setValues] = useState<Record<MethodKey, string>>({
    monzo: initialMonzo,
    paypal: initialPaypal,
    revolut: initialRevolut,
    bank: initialBank,
  });
  const [share, setShare] = useState(initialShare);
  const [shareSaving, setShareSaving] = useState(false);
  const [open, setOpen] = useState<MethodKey | null>(null);
  const [draft, setDraft] = useState("");
  const [bank, setBank] = useState({ name: "", sort: "", account: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = open ? METHODS.find((m) => m.key === open) ?? null : null;

  function openMethod(key: MethodKey) {
    setError(null);
    if (key === "bank") setBank(parseBank(values.bank));
    else setDraft(values[key]);
    setOpen(key);
  }

  function back() {
    setError(null);
    setOpen(null);
  }

  async function save() {
    if (!active) return;
    const value =
      active.key === "bank"
        ? [bank.name.trim(), bank.sort.trim(), bank.account.trim()].filter(Boolean).join(" · ")
        : draft.trim();
    setSaving(true);
    setError(null);
    try {
      const { error: upErr } = await supabase
        .from("payment_details")
        .upsert(
          { user_id: userId, share_with_house: share, [active.column]: value || null },
          { onConflict: "user_id" },
        );
      if (upErr) throw upErr;
      setValues((v) => ({ ...v, [active.key]: value }));
      setOpen(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveShare(next: boolean) {
    setShareSaving(true);
    setError(null);
    setShare(next); // optimistic — the switch should feel instant
    try {
      const { error: upErr } = await supabase
        .from("payment_details")
        .upsert({ user_id: userId, share_with_house: next }, { onConflict: "user_id" });
      if (upErr) throw upErr;
      router.refresh();
    } catch (err) {
      setShare(!next);
      setError(err instanceof Error ? err.message : "Couldn't save. Please try again.");
    } finally {
      setShareSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <span className="label">Payment details</span>
      <p className="-mt-1 mb-3 text-xs text-slate-400">
        Optional. Lets housemates pay you back in a tap, and the switch below controls whether your
        house can see them, and HouseSync never touches the money.
      </p>

      {active ? (
        /* Expanded editor — fills the whole box */
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-900">{active.label}</p>

          {active.key === "bank" ? (
            <div className="space-y-2.5">
              <BankField
                label="Cardholder name"
                placeholder="Jordan Smith"
                value={bank.name}
                autoFocus
                onChange={(v) => setBank((b) => ({ ...b, name: v }))}
                onEnter={() => void save()}
              />
              <div className="grid grid-cols-2 gap-2.5">
                <BankField
                  label="Sort code"
                  placeholder="12-34-56"
                  inputMode="numeric"
                  value={bank.sort}
                  onChange={(v) => setBank((b) => ({ ...b, sort: formatSort(v) }))}
                  onEnter={() => void save()}
                />
                <BankField
                  label="Account number"
                  placeholder="12345678"
                  inputMode="numeric"
                  value={bank.account}
                  onChange={(v) => setBank((b) => ({ ...b, account: formatAccount(v) }))}
                  onEnter={() => void save()}
                />
              </div>
              <p className="text-xs text-slate-400">
                Housemates copy these for a manual bank transfer.
              </p>
            </div>
          ) : (
            <>
              <input
                autoFocus
                className="input"
                placeholder={active.placeholder}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void save();
                  }
                }}
              />
              <p className="mt-1.5 text-xs text-slate-400">{active.hint}</p>
            </>
          )}

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-700"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  d="M12 15l-5-5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="btn-primary px-4 py-1.5 text-sm"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        /* Collapsed — one button per method, tick once saved */
        <>
        <div className="space-y-2">
          {METHODS.map((m) => {
            const filled = values[m.key].trim().length > 0;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => openMethod(m.key)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]"
              >
                <span className="shrink-0 text-sm font-medium text-slate-800">{m.label}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
                  {filled ? values[m.key] : ""}
                </span>
                {filled ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-mint-600">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">Add</span>
                )}
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true">
                  <path
                    d="M8 5l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            );
          })}
        </div>

        {/* Consent switch — who can see the handles above */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
          <div>
            <p className="text-sm font-medium text-slate-800">Visible to housemates</p>
            <p className="text-xs text-slate-400">
              {share
                ? "People in your house can see these to pay you back."
                : "Hidden, only you can see these right now."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={share}
            aria-label="Visible to housemates"
            disabled={shareSaving}
            onClick={() => void saveShare(!share)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              share ? "bg-brand-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                share ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}

function BankField({
  label,
  placeholder,
  value,
  onChange,
  onEnter,
  inputMode,
  autoFocus,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  inputMode?: "numeric";
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <input
        className="input"
        placeholder={placeholder}
        value={value}
        inputMode={inputMode}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
      />
    </div>
  );
}
