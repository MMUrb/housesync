"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_BODY,
  MAX_SUBJECT,
  bodyToHtml,
  canReceive,
  firstNameOf,
  personalise,
  type BroadcastKind,
  type Person,
} from "@/lib/broadcast";

export type SentRow = {
  id: string;
  when: string;
  kind: string;
  subject: string;
  recipients: number;
  sent: number;
  failed: number;
};

const KINDS: { key: BroadcastKind; label: string; hint: string }[] = [
  {
    key: "news",
    label: "News",
    hint: "Goes to people with \"News from HouseSync\" on in Settings, with an unsubscribe link.",
  },
  {
    key: "service",
    label: "Service notice",
    hint: "Goes to everyone. Only for things people must know, like changes to the terms. Never for promotion.",
  },
];

export function EmailComposer({
  people,
  history,
  historyMissing,
  adminName,
}: {
  people: Person[];
  history: SentRow[];
  historyMissing: boolean;
  adminName: string | null;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<BroadcastKind>("news");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("Hi {first name},\n\n");
  const [mode, setMode] = useState<"all" | "choose">("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const eligible = useMemo(() => people.filter((p) => canReceive(p, kind)), [people, kind]);
  const recipients = mode === "all" ? eligible : eligible.filter((p) => picked.has(p.id));
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) =>
      [p.name, p.email, p.house].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [people, query]);

  const previewPerson = recipients[0] ?? eligible[0] ?? { name: adminName };
  const previewFirst = firstNameOf({ name: previewPerson.name ?? null });
  const ready = subject.trim().length > 0 && body.trim().length > 0;

  function edit<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setConfirming(false);
      setResult(null);
    };
  }

  async function send(test: boolean) {
    if (!ready) return setResult({ ok: false, text: "Add a subject and a message first." });
    if (!test && !confirming) return setConfirming(true);
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/email/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          subject,
          body,
          ids: mode === "choose" ? [...picked] : null,
          test,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "That didn't send.");
      if (test) {
        setResult({ ok: true, text: `Test sent to ${j.sentTo}. Check your inbox.` });
      } else {
        const bits = [`Sent to ${j.sent} of ${j.recipients}`];
        if (j.failed) bits.push(`${j.failed} failed`);
        if (j.notReached) bits.push(`${j.notReached} not reached (time limit), send again to those people`);
        setResult({ ok: !j.failed && !j.notReached, text: bits.join(" · ") });
        setConfirming(false);
        router.refresh();
      }
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "That didn't send." });
    } finally {
      setBusy(false);
    }
  }

  const togglePick = (id: string) =>
    edit(setPicked)(
      (() => {
        const next = new Set(picked);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      })(),
    );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Write an email</p>
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">What kind of email</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-0.5 text-sm font-semibold dark:bg-white/[0.06]">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => edit(setKind)(k.key)}
                  className={`rounded-md px-3 py-1.5 transition ${
                    kind === k.key
                      ? "bg-white text-slate-900 shadow-sm dark:bg-white/[0.12]"
                      : "text-slate-500"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{KINDS.find((k) => k.key === kind)?.hint}</p>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Subject</span>
            <input
              className="input"
              value={subject}
              maxLength={MAX_SUBJECT}
              onChange={(e) => edit(setSubject)(e.target.value)}
              placeholder="Part payments are here"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Message</span>
            <textarea
              className="input min-h-[200px] leading-relaxed"
              value={body}
              maxLength={MAX_BODY}
              onChange={(e) => edit(setBody)(e.target.value)}
            />
          </label>
          <p className="text-xs text-slate-500">
            {"{first name}"} is filled in for each person. A blank line starts a new paragraph, and
            web addresses become links.
            {kind === "news" && " The unsubscribe link is added automatically."}
          </p>
        </section>

        <section className="card space-y-3 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Who gets it</p>
          <div className="grid grid-cols-2 gap-2">
            {(["all", "choose"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => edit(setMode)(m)}
                className={`rounded-xl border p-3 text-left text-sm transition ${
                  mode === m
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                <span className="block font-semibold">
                  {m === "all" ? (kind === "news" ? "Everyone opted in" : "Everyone") : "Choose people"}
                </span>
                <span className="text-xs opacity-80">
                  {m === "all"
                    ? `${eligible.length} of ${people.length} people`
                    : `${eligible.filter((p) => picked.has(p.id)).length} picked`}
                </span>
              </button>
            ))}
          </div>
          {mode === "choose" && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <input
                className="w-full border-b border-slate-200 bg-transparent px-3 py-2 text-sm outline-none"
                placeholder="Search name, email or house…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <ul className="max-h-80 overflow-y-auto">
                {shown.map((p) => {
                  const ok = canReceive(p, kind);
                  return (
                    <li key={p.id} className="border-b border-slate-100 last:border-0">
                      <label
                        className={`flex items-center gap-3 px-3 py-2 text-sm ${
                          ok ? "cursor-pointer" : "opacity-45"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!ok}
                          checked={ok && picked.has(p.id)}
                          onChange={() => togglePick(p.id)}
                        />
                        <span className="min-w-0 flex-1 truncate text-slate-800">
                          {p.name || p.email || "No name"}
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {ok ? p.house ?? "" : !p.email ? "no email" : !p.emailOn ? "email off" : "news off"}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void send(true)}>
            Send a test to me
          </button>
          <button
            type="button"
            className="btn-primary ml-auto"
            disabled={busy || recipients.length === 0}
            onClick={() => void send(false)}
          >
            {busy
              ? "Sending…"
              : confirming
                ? `Tap again to send to ${recipients.length}`
                : `Send to ${recipients.length} ${recipients.length === 1 ? "person" : "people"}`}
          </button>
        </div>
        {result && (
          <p
            className={`rounded-xl px-3 py-2 text-sm ${
              result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {result.text}
          </p>
        )}
      </div>

      <div className="space-y-6">
        <section className="card p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</p>
          {/* Always light: it's what lands in an inbox, not part of the admin. */}
          <div className="rounded-xl bg-[#f6f7fb] p-5 font-[Arial,Helvetica,sans-serif] text-[14px] leading-relaxed text-[#15151c]">
            <p className="mb-3 border-b border-[#e2e8f0] pb-2.5 text-xs text-[#64748b]">
              <b className="text-[#15151c]">HouseSync</b> &lt;hello@housesync.co.uk&gt;
              <br />
              Subject: <b className="text-[#15151c]">{personalise(subject, previewFirst) || "…"}</b>
            </p>
            <p className="mb-3 text-[17px] font-bold">
              House<span className="text-[#5f3fe0]">Sync</span>
            </p>
            <div dangerouslySetInnerHTML={{ __html: bodyToHtml(personalise(body, previewFirst)) }} />
            <p className="mt-4 border-t border-[#e5e7eb] pt-3 text-[11.5px] text-[#94a3b8]">
              {kind === "news" ? (
                <>
                  You&rsquo;re getting this because News from HouseSync is on for your account.{" "}
                  <u className="text-[#5f3fe0]">Unsubscribe from news</u>, or change all your email
                  choices in Settings.
                </>
              ) : (
                "You're getting this service notice because you have a HouseSync account."
              )}
            </p>
          </div>
          <p className="mt-2 text-xs text-slate-400">Shown as {previewFirst} would see it.</p>
        </section>

        <section className="card p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sent before</p>
          {historyMissing ? (
            <p className="text-sm text-amber-600">
              History isn&rsquo;t available until migration 0051 has been run.
            </p>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing sent yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-slate-800">{h.subject}</span>
                    <span className="text-xs text-slate-400">
                      {h.when}
                      {h.kind === "service" ? " · service notice" : ""}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs ${h.failed ? "text-amber-600" : "text-emerald-600"}`}>
                    {h.sent} sent{h.failed ? ` · ${h.failed} failed` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
