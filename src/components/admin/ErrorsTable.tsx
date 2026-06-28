"use client";

import { useState } from "react";
import { ResolveOneButton } from "@/components/admin/ErrorActions";

// One row of the error log, with dates already formatted on the server so this
// client component never calls toLocaleString itself (which would mismatch
// between SSR and hydration — the very bug this page exists to catch).
export type ErrorRowView = {
  id: string;
  whenLabel: string;
  source: string;
  message: string;
  url: string | null;
  user_id: string | null;
  user_agent: string | null;
  stack: string | null;
  digest: string | null;
  resolved: boolean;
  resolvedLabel: string | null;
};

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-slate-700">{value ?? "—"}</dd>
    </div>
  );
}

export function ErrorsTable({ rows }: { rows: ErrorRowView[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const currentCount = rows.filter((r) => !r.resolved).length;
  const resolvedCount = rows.length - currentCount;
  const [tab, setTab] = useState<"current" | "resolved">(
    currentCount > 0 ? "current" : "resolved",
  );

  const visible = rows.filter((r) => (tab === "resolved" ? r.resolved : !r.resolved));

  return (
    <div>
      <div className="mb-3 flex rounded-lg bg-slate-100 p-0.5 text-sm font-semibold dark:bg-white/[0.06]">
        {([
          ["current", currentCount],
          ["resolved", resolvedCount],
        ] as const).map(([key, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setOpenId(null);
            }}
            className={`flex-1 rounded-md px-3 py-1.5 capitalize transition ${
              tab === key
                ? "bg-white text-slate-900 shadow-sm dark:bg-white/[0.12]"
                : "text-slate-500"
            }`}
          >
            {key} ({count})
          </button>
        ))}
      </div>

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Message</th>
                <th className="px-4 py-2.5 font-medium">Path</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-slate-400">
                    {tab === "current" ? "No current errors. 🎉" : "Nothing resolved yet."}
                  </td>
                </tr>
              ) : (
                visible.map((r) => {
                const open = openId === r.id;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setOpenId(open ? null : r.id)}
                    aria-expanded={open}
                    className={`cursor-pointer border-b border-slate-50 align-top last:border-0 hover:bg-slate-50 ${
                      r.resolved ? "opacity-50" : ""
                    } ${open ? "bg-slate-50" : ""}`}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{r.whenLabel}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`chip ${
                          r.source === "server"
                            ? "bg-red-50 text-red-600"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {r.source}
                      </span>
                    </td>
                    <td className="max-w-md px-4 py-2.5 text-slate-700">
                      <span className={open ? "break-words" : "line-clamp-2 break-words"}>
                        {r.message}
                      </span>
                      {open && (
                        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 font-normal">
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                            <Field label="When" value={r.whenLabel} />
                            <Field label="Source" value={r.source} />
                            <Field label="Path" value={r.url} />
                            <Field label="User" value={r.user_id} />
                            <Field label="Digest" value={r.digest} />
                            <Field
                              label="Status"
                              value={r.resolved ? `Resolved ${r.resolvedLabel ?? ""}`.trim() : "Unresolved"}
                            />
                          </dl>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                              User agent
                            </p>
                            <p className="mt-0.5 break-words text-slate-600">{r.user_agent ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">
                              Stack trace
                            </p>
                            {r.stack ? (
                              <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100 dark:bg-black/40">
                                {r.stack}
                              </pre>
                            ) : (
                              <p className="mt-0.5 text-slate-400">No stack captured.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{r.url ?? "-"}</td>
                    <td
                      className="px-4 py-2.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.resolved ? (
                        <span className="text-xs text-slate-300">resolved</span>
                      ) : (
                        <ResolveOneButton id={r.id} />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
