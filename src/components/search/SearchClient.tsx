"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { SearchHit, SearchResponse } from "@/app/api/search/route";
import { formatMoney } from "@/lib/format";

// The search screen. Typing hits /api/search after a short pause; results
// come back grouped by where they live and are filtered client-side by the
// pills. Recent searches stay on the device (localStorage), nothing extra is
// written to the database.

const RECENT_KEY = "hs_search_recent";
const RECENT_MAX = 6;
const DEBOUNCE_MS = 250;

type Group = "all" | "money" | "chat" | "notices" | "shopping";

export interface SearchShortcut {
  href: string;
  title: string;
  detail: string;
  tone: "brand" | "mint" | "amber";
}

export function SearchClient({
  houseName,
  currency,
  shortcuts,
  initialQuery = "",
}: {
  houseName: string;
  currency: string;
  shortcuts: SearchShortcut[];
  initialQuery?: string;
}) {
  const router = useRouter();
  // Seed from the live URL, not only the server prop: after Back from a
  // result the router restores the URL we wrote below, but re-serves the
  // cached page RSC (rendered with an empty initialQuery).
  const sp = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(sp.get("q") ?? initialQuery);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<Group>("all");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    inputRef.current?.focus();
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw).filter((s: unknown) => typeof s === "string").slice(0, RECENT_MAX));
    } catch {
      /* ignore */
    }
  }, []);

  // Debounced fetch; an in-flight request for a stale query is abandoned.
  // Keep the query in the URL so Back from a result restores this screen.
  // Written only once the query has settled (inside the debounce) and only
  // when it differs: Safari throws after 100 history writes in 30 seconds,
  // so a per-keystroke write would crash the app mid-search on iOS.
  const wroteUrl = useRef("");
  function syncUrl(term: string) {
    const next = term.length >= 2 ? `/search?q=${encodeURIComponent(term)}` : "/search";
    wroteUrl.current = term.length >= 2 ? term : "";
    try {
      if (window.location.pathname + window.location.search !== next) {
        window.history.replaceState(null, "", next);
      }
    } catch {
      /* ignore */
    }
  }

  // An external URL change (the header search icon while already here, or
  // Back) must re-sync the box; our own writes are recognised via wroteUrl.
  const urlQ = sp.get("q") ?? "";
  useEffect(() => {
    if (urlQ !== wroteUrl.current) setQ(urlQ);
  }, [urlQ]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      syncUrl("");
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      syncUrl(term);
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error("Search failed.");
        const data = (await res.json()) as SearchResponse;
        if (!ctrl.signal.aborted) {
          setResults(data);
          setGroup("all");
        }
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Search failed.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function remember(term: string) {
    const t = term.trim();
    if (t.length < 2) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_MAX);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function forget(term: string) {
    const next = recent.filter((r) => r !== term);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const term = q.trim();
  const counts = results
    ? {
        money: results.money.length,
        chat: results.chat.length,
        notices: results.notices.length,
        shopping: results.shopping.length,
      }
    : { money: 0, chat: 0, notices: 0, shopping: 0 };
  const total = counts.money + counts.chat + counts.notices + counts.shopping;
  const show = (g: Exclude<Group, "all">) => group === "all" || group === g;

  return (
    <div className="-mt-1">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/dashboard"))}
          aria-label="Back"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 dark:hover:bg-white/[0.06]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
            <path d="M15 18 9 12l6-6" />
          </svg>
        </button>
        <label className="input flex flex-1 items-center gap-2 py-2.5 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-[17px] w-[17px] shrink-0 text-slate-400" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Search expenses, chat, notices…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") remember(q);
              if (e.key === "Escape") setQ("");
            }}
            aria-label={`Search ${houseName}`}
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-slate-900 outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600 dark:bg-white/20"
            >
              ×
            </button>
          )}
        </label>
      </div>

      {/* Empty state: recents + shortcuts */}
      {term.length < 2 && (
        <div className="mt-4 space-y-4">
          {recent.length > 0 && (
            <section>
              <GroupHeading label="Recent" />
              <ul className="card divide-y divide-slate-100">
                {recent.map((r) => (
                  <li key={r} className="flex items-center gap-3 px-4 py-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px] shrink-0 text-slate-400" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3.2 2" />
                    </svg>
                    <button
                      type="button"
                      onClick={() => setQ(r)}
                      className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-700"
                    >
                      {r}
                    </button>
                    <button
                      type="button"
                      onClick={() => forget(r)}
                      aria-label={`Remove ${r} from recent searches`}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <GroupHeading label="Jump to" />
            <ul className="card divide-y divide-slate-100">
              {shortcuts.map((s) => (
                <li key={s.href + s.title}>
                  <Link href={s.href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-white/[0.04]">
                    <KindIcon tone={s.tone} kind={s.tone === "mint" ? "shopping" : s.tone === "amber" ? "notice" : "expense"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{s.title}</span>
                      <span className="block text-xs text-slate-500">{s.detail}</span>
                    </span>
                    <Chevron />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* Results */}
      {term.length >= 2 && (
        <div className="mt-3">
          {results && total > 0 && (
            <div className="no-scrollbar -mx-4 mb-1 flex gap-2 overflow-x-auto px-4 py-1">
              <Pill on={group === "all"} onClick={() => setGroup("all")}>All {total}</Pill>
              {counts.money > 0 && <Pill on={group === "money"} onClick={() => setGroup("money")}>Money {counts.money}</Pill>}
              {counts.chat > 0 && <Pill on={group === "chat"} onClick={() => setGroup("chat")}>Chat {counts.chat}</Pill>}
              {counts.notices > 0 && <Pill on={group === "notices"} onClick={() => setGroup("notices")}>Notices {counts.notices}</Pill>}
              {counts.shopping > 0 && <Pill on={group === "shopping"} onClick={() => setGroup("shopping")}>Shopping {counts.shopping}</Pill>}
            </div>
          )}

          {loading && !results && (
            <p className="px-1 py-6 text-center text-sm text-slate-400">Searching…</p>
          )}
          {error && <p className="px-1 py-6 text-center text-sm text-red-600">{error}</p>}
          {results && total === 0 && !loading && (
            <div className="card mt-2 p-6 text-center text-sm text-slate-500">
              Nothing for &ldquo;{results.q}&rdquo; in {houseName}.
            </div>
          )}

          {results && (
            <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
              {show("money") && counts.money > 0 && (
                <ResultGroup label="Money" count={counts.money} hits={results.money} q={results.q} currency={currency} onPick={() => remember(results.q)} />
              )}
              {show("chat") && counts.chat > 0 && (
                <ResultGroup label="Chat" count={counts.chat} hits={results.chat} q={results.q} currency={currency} onPick={() => remember(results.q)} />
              )}
              {show("notices") && counts.notices > 0 && (
                <ResultGroup label="Noticeboard" count={counts.notices} hits={results.notices} q={results.q} currency={currency} onPick={() => remember(results.q)} />
              )}
              {show("shopping") && counts.shopping > 0 && (
                <ResultGroup label="Shopping list" count={counts.shopping} hits={results.shopping} q={results.q} currency={currency} onPick={() => remember(results.q)} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupHeading({ label, count }: { label: string; count?: number }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
      {label}
      {typeof count === "number" && (
        <span className="rounded-full bg-slate-200 px-1.5 py-px text-[10px] font-bold text-slate-600 dark:bg-white/10">
          {count}
        </span>
      )}
    </h2>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`chip shrink-0 border ${
        on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}

function ResultGroup({
  label,
  count,
  hits,
  q,
  currency,
  onPick,
}: {
  label: string;
  count: number;
  hits: SearchHit[];
  q: string;
  currency: string;
  onPick: () => void;
}) {
  return (
    <section>
      <GroupHeading label={label} count={count} />
      <ul className="card divide-y divide-slate-100">
        {hits.map((h) => (
          <li key={`${h.kind}-${h.id}`}>
            <Link
              href={h.href}
              onClick={onPick}
              className="flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
            >
              <KindIcon kind={h.kind} tone={h.kind === "message" ? "sky" : h.kind === "notice" ? "amber" : h.kind === "shopping" ? "mint" : "brand"} />
              <span className="min-w-0 flex-1">
                {h.kind === "message" ? (
                  <>
                    <span className="block text-xs text-slate-500">
                      {h.title} · {h.subtitle}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-slate-700">
                      <Highlight text={h.snippet ?? ""} q={q} />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block text-sm font-semibold leading-snug text-slate-900">
                      <Highlight text={h.title} q={q} />
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{h.subtitle}</span>
                    {h.snippet && (
                      <span className="mt-0.5 block text-xs leading-snug text-slate-600">
                        <Highlight text={h.snippet} q={q} />
                      </span>
                    )}
                  </>
                )}
              </span>
              {typeof h.amount === "number" && (
                <span className="shrink-0 pl-2 text-sm font-bold text-slate-900">{formatMoney(h.amount, currency)}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Wraps case-insensitive matches of q in <mark>. */
function Highlight({ text, q }: { text: string; q: string }) {
  const term = q.replace(/\*/g, " ").trim();
  if (!term) return <>{text}</>;
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === term.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-amber-200 px-0.5 font-bold text-slate-900 dark:bg-amber-400/40 dark:text-white">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function KindIcon({ kind, tone }: { kind: SearchHit["kind"]; tone: "brand" | "mint" | "amber" | "sky" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    mint: "bg-mint-50 text-mint-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  } as const;
  return (
    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
        {kind === "message" ? (
          <>
            <path d="M21 12a8 8 0 1 1-3.5-6.6" />
            <path d="M3 20.5 4.6 16" />
          </>
        ) : kind === "notice" ? (
          <>
            <path d="M12 3v6M8.5 9h7l1.5 6H7Z" />
            <path d="M12 15v6" />
          </>
        ) : kind === "shopping" ? (
          <>
            <path d="M3 4h2l2.4 11h11l2-8H6.2" />
            <circle cx="9.5" cy="19.5" r="1.3" />
            <circle cx="17" cy="19.5" r="1.3" />
          </>
        ) : kind === "bill" ? (
          <>
            <path d="M17 2.5a3.5 3.5 0 0 1 0 7M7 21.5a3.5 3.5 0 0 1 0-7" />
            <path d="M20 12a8 8 0 0 1-8 8M4 12a8 8 0 0 1 8-8" />
          </>
        ) : (
          <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2Z" />
        )}
      </svg>
    </span>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true">
      <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
