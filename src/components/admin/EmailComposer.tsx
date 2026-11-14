"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_BODY,
  MAX_BODY_HTML,
  MAX_SUBJECT,
  canReceive,
  firstNameOf,
  personalise,
  hasEmbeddedImages,
  renderBody,
  type BodyFormat,
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
  const [format, setFormat] = useState<BodyFormat>("text");
  const frame = useRef<HTMLIFrameElement>(null);
  const [frameHeight, setFrameHeight] = useState(420);
  // Scale the preview down so the whole email fits on screen at once. Width
  // stays fixed (it only shrinks visually), so the scale can't feed back into
  // the height it was worked out from.
  const box = useRef<HTMLDivElement>(null);
  const historyCard = useRef<HTMLElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => {
      const natural = el.offsetHeight; // layout height, before the transform
      // Room left once the card's label, padding and the note below are in.
      // On wide screens the pinned column also holds the history card, so
      // the preview gets what is left after it (and the gap between).
      const wide = window.matchMedia("(min-width: 1024px)").matches;
      const below = wide && historyCard.current ? historyCard.current.offsetHeight + 24 : 0;
      const available = Math.max(150, window.innerHeight - 130 - below);
      const scale = Math.min(1, Math.max(0.4, available / natural));
      setFit({ scale, height: natural * scale });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (historyCard.current) ro.observe(historyCard.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
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
  // Caught here, before sending, with the reason: embedded images bloat the
  // email and Gmail/Outlook block them; over the limit the server refuses.
  const htmlProblem =
    format !== "html"
      ? null
      : hasEmbeddedImages(body)
        ? "This HTML has images pasted into it (data:image). Gmail and Outlook block those, and they make the email too big. Put each image online and use <img src=\"https://...\"> instead."
        : body.length > MAX_BODY_HTML
          ? `This HTML is ${body.length.toLocaleString("en-GB")} characters; the limit is ${MAX_BODY_HTML.toLocaleString("en-GB")}. Trim it, or check for images pasted into it.`
          : null;

  // Set after a real send. While set, the button reads "Sent" and can't fire
  // again; any change below makes it a new email and clears it.
  const [sent, setSent] = useState<{
    sent: number;
    recipients: number;
    failed: number;
    notReached: number;
    at: string;
    subject: string;
  } | null>(null);

  function edit<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setConfirming(false);
      setResult(null);
      setSent(null);
    };
  }

  function startOver() {
    setSubject("");
    setBody("Hi {first name},\n\n");
    setPicked(new Set());
    setMode("all");
    setQuery("");
    setConfirming(false);
    setResult(null);
    setSent(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function send(test: boolean) {
    if (!ready) return setResult({ ok: false, text: "Add a subject and a message first." });
    if (htmlProblem) return setResult({ ok: false, text: htmlProblem });
    if (!test && sent) return;
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
          format,
          ids: mode === "choose" ? [...picked] : null,
          test,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "That didn't send.");
      if (test) {
        setResult({ ok: true, text: `Test sent to ${j.sentTo}. Check your inbox.` });
      } else {
        setSent({
          sent: j.sent ?? 0,
          recipients: j.recipients ?? 0,
          failed: j.failed ?? 0,
          notReached: j.notReached ?? 0,
          at: new Date().toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/London",
          }),
          subject: personalise(subject, previewFirst),
        });
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
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Format</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-0.5 text-sm font-semibold dark:bg-white/[0.06]">
              {(
                [
                  ["text", "Plain text"],
                  ["html", "HTML"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => edit(setFormat)(k)}
                  className={`rounded-md px-3 py-1.5 transition ${
                    format === k
                      ? "bg-white text-slate-900 shadow-sm dark:bg-white/[0.12]"
                      : "text-slate-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {format === "html" && (
              <p className="mt-1.5 text-xs text-slate-500">
                Paste your own HTML. Images need a public https address. The HouseSync header and the
                unsubscribe footer are added around it, and scripts are removed.
              </p>
            )}
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
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              {format === "html" ? "HTML" : "Message"}
            </span>
            <textarea
              className={`input min-h-[200px] leading-relaxed ${format === "html" ? "font-mono text-xs" : ""}`}
              value={body}
              spellCheck={format !== "html"}
              // HTML is checked below rather than cut off: silently chopping a
              // pasted template mid-tag breaks it without saying why.
              maxLength={format === "html" ? undefined : MAX_BODY}
              onChange={(e) => edit(setBody)(e.target.value)}
            />
          </label>
          <p className="text-xs text-slate-500">
            {"{first name}"} is filled in for each person.
            {format === "text" && " A blank line starts a new paragraph, and web addresses become links."}
            {kind === "news" && " The unsubscribe link is added automatically."}
          </p>
          {htmlProblem && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
              {htmlProblem}
            </p>
          )}
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
          {sent ? (
            <button
              type="button"
              disabled
              className="ml-auto rounded-xl border border-emerald-600/40 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300"
            >
              ✓ Sent
            </button>
          ) : (
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
          )}
        </div>
        {sent &&
          (() => {
            const clean = sent.failed === 0 && sent.notReached === 0;
            const n = (k: number) => `${k} ${k === 1 ? "person" : "people"}`;
            return (
              <div
                className={`flex gap-3 rounded-2xl border p-4 ${
                  clean
                    ? "border-emerald-600/30 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-500/15"
                    : "border-amber-500/40 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/15"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-white ${
                    clean ? "bg-emerald-600" : "bg-amber-500"
                  }`}
                >
                  {clean ? "✓" : "!"}
                </span>
                <div className="min-w-0 text-sm">
                  <p
                    className={`font-semibold ${clean ? "text-emerald-800 dark:text-emerald-200" : "text-amber-800 dark:text-amber-200"}`}
                  >
                    {clean
                      ? `Sent to ${n(sent.sent)} at ${sent.at}`
                      : `Sent to ${sent.sent} of ${n(sent.recipients)} at ${sent.at}`}
                  </p>
                  <p className={clean ? "text-emerald-700 dark:text-emerald-300/90" : "text-amber-700 dark:text-amber-300/90"}>
                    &ldquo;{sent.subject}&rdquo; is on its way. It&rsquo;s now listed under Sent before.
                    {sent.failed > 0 && ` ${n(sent.failed)} couldn't be emailed (a bad address, usually).`}
                    {sent.notReached > 0 &&
                      ` ${n(sent.notReached)} weren't reached in time: choose them and send again.`}
                  </p>
                  <button
                    type="button"
                    onClick={startOver}
                    className="mt-1.5 font-semibold text-brand-600 hover:underline"
                  >
                    Write a new email →
                  </button>
                </div>
              </div>
            );
          })()}
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

      {/* The whole column is pinned on wide screens, preview and history
          together, so neither can slide under the other while scrolling. */}
      <div className="space-y-6 lg:sticky lg:top-4 lg:self-start">
        <section className="card p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</p>
          {/* Shrunk to fit the screen: the outer box takes the scaled height so
              nothing below it overlaps or leaves a gap. */}
          <div className="overflow-hidden" style={{ height: fit.height || undefined }}>
          {/* Always light: it's what lands in an inbox, not part of the admin. */}
          <div
            ref={box}
            className="rounded-xl bg-[#f6f7fb] p-5 font-[Arial,Helvetica,sans-serif] text-[14px] leading-relaxed text-[#15151c]"
            style={{ transform: `scale(${fit.scale})`, transformOrigin: "top center" }}
          >
            <p className="mb-3 border-b border-[#e2e8f0] pb-2.5 text-xs text-[#64748b]">
              <b className="text-[#15151c]">HouseSync</b> &lt;hello@housesync.co.uk&gt;
              <br />
              Subject: <b className="text-[#15151c]">{personalise(subject, previewFirst) || "…"}</b>
            </p>
            <p className="mb-3 text-[17px] font-bold">
              House<span className="text-[#5f3fe0]">Sync</span>
            </p>
            {format === "text" ? (
              <div dangerouslySetInnerHTML={{ __html: renderBody(body, "text", previewFirst) }} />
            ) : (
              // Pasted HTML is shown in a sandbox with scripts off, so nothing
              // in it can run inside the admin. allow-same-origin (without
              // allow-scripts) only lets us measure its height to fit it.
              <iframe
                ref={frame}
                title="Email preview"
                sandbox="allow-same-origin"
                className="w-full border-0 bg-transparent"
                style={{ height: frameHeight }}
                srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#15151c;background:#f6f7fb}img{max-width:100%;height:auto}</style></head><body>${renderBody(body, "html", previewFirst)}</body></html>`}
                onLoad={() => {
                  const h = frame.current?.contentDocument?.documentElement.scrollHeight;
                  if (h) setFrameHeight(Math.min(Math.max(h + 4, 120), 2000));
                }}
              />
            )}
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
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Shown as {previewFirst} would see it
            {fit.scale < 0.99 ? `, shrunk to ${Math.round(fit.scale * 100)}% to fit your screen` : ""}.
          </p>
        </section>

        <section ref={historyCard} className="card p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sent before</p>
          {historyMissing ? (
            <p className="text-sm text-amber-600">
              History isn&rsquo;t available until migration 0051 has been run.
            </p>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing sent yet.</p>
          ) : (
            <ul className="max-h-40 divide-y divide-slate-100 overflow-y-auto pr-1 text-sm">
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
