"use client";

import { useState } from "react";
import { COUNTRIES } from "@/lib/countries";

function buildE164(dial: string, national: string): string {
  const digits = national.replace(/\D/g, "").replace(/^0+/, "");
  return `${dial}${digits}`;
}

export function PhoneVerification({
  initialPhone,
  initialVerified,
}: {
  initialPhone: string;
  initialVerified: boolean;
}) {
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(
    initialVerified && initialPhone ? initialPhone : null,
  );
  const [editing, setEditing] = useState<boolean>(!(initialVerified && initialPhone));
  const [step, setStep] = useState<"enter" | "code">("enter");
  const [dial, setDial] = useState("+44");
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function sendCode() {
    setError(null);
    setInfo(null);
    const phone = buildE164(dial, national);
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      setError("Enter a valid phone number.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/phone/send-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not send the code.");
      setPendingPhone(phone);
      setStep("code");
      setInfo(`We texted a 6-digit code to ${phone}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/phone/verify-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not verify the code.");
      setVerifiedPhone(j.phone || pendingPhone);
      setEditing(false);
      setStep("enter");
      setCode("");
      setNational("");
      setInfo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify the code.");
    } finally {
      setBusy(false);
    }
  }

  if (verifiedPhone && !editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
        <div>
          <p className="text-sm font-medium text-slate-800">{verifiedPhone}</p>
          <p className="text-xs font-medium text-mint-600">✓ Verified</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setStep("enter");
            setError(null);
            setInfo(null);
          }}
          className="btn-ghost px-3 py-1.5 text-xs"
        >
          Change number
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      {step === "enter" ? (
        <>
          <select
            value={dial}
            onChange={(e) => setDial(e.target.value)}
            aria-label="Country code"
            className="input"
          >
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.dial}>
                {c.flag} {c.name} ({c.dial})
              </option>
            ))}
          </select>
          <input
            type="tel"
            inputMode="tel"
            className="input"
            placeholder="Phone number, e.g. 7700 900000"
            value={national}
            onChange={(e) => setNational(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={sendCode}
              disabled={busy}
              className="btn-primary px-3 py-1.5 text-sm"
            >
              {busy ? "Sending…" : "Send code"}
            </button>
            {verifiedPhone && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setInfo(null);
                }}
                className="btn-ghost px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {info && <p className="text-xs text-slate-500">{info}</p>}
          <input
            inputMode="numeric"
            className="input tracking-[0.4em]"
            placeholder="123456"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={verify}
              disabled={busy || code.length < 4}
              className="btn-primary px-3 py-1.5 text-sm"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button type="button" onClick={sendCode} disabled={busy} className="btn-ghost px-3 py-1.5 text-sm">
              Resend
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("enter");
                setCode("");
                setError(null);
              }}
              className="btn-ghost px-3 py-1.5 text-sm"
            >
              Back
            </button>
          </div>
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-slate-400">
        🔒 Private — never shown to housemates. We text a one-time code to confirm it&apos;s yours.
      </p>
    </div>
  );
}
