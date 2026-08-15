"use client";

import { useEffect } from "react";

// The "how does simplified settle up work?" bottom sheet. Static worked
// example (fictional housemates) rather than live house data: the point is to
// teach the idea once, and the settle card already shows the real numbers.
// Shown when the mode is first switched on, and any time from the settle card.

const NODE = {
  you: { fill: "#e7e5ff", stroke: "#c7c0ff", text: "#4f31bd" },
  sam: { fill: "#ffe4e6", stroke: "#fbcfd4", text: "#be123c" },
  alex: { fill: "#dbeafe", stroke: "#bfdbfe", text: "#1d4ed8" },
  priya: { fill: "#fef3c7", stroke: "#fde68a", text: "#a16207" },
};

function People() {
  return (
    <g textAnchor="middle" fontSize="15" fontWeight="700">
      <circle cx="78" cy="46" r="27" fill={NODE.you.fill} stroke={NODE.you.stroke} strokeWidth="2" />
      <text x="78" y="51" fill={NODE.you.text}>You</text>
      <circle cx="342" cy="46" r="27" fill={NODE.sam.fill} stroke={NODE.sam.stroke} strokeWidth="2" />
      <text x="342" y="51" fill={NODE.sam.text}>Sam</text>
      <circle cx="342" cy="144" r="27" fill={NODE.alex.fill} stroke={NODE.alex.stroke} strokeWidth="2" />
      <text x="342" y="149" fill={NODE.alex.text}>Alex</text>
      <circle cx="78" cy="144" r="27" fill={NODE.priya.fill} stroke={NODE.priya.stroke} strokeWidth="2" />
      <text x="78" y="149" fill={NODE.priya.text} fontSize="13.5">Priya</text>
    </g>
  );
}

function AmountTag({ x, y, dark, children }: { x: number; y: number; dark?: boolean; children: string }) {
  return (
    <g>
      <rect x={x} y={y} width="58" height="19" rx="6" fill={dark ? "#5f3fe0" : "#fff"} stroke={dark ? "none" : "#e2e8f0"} />
      <text x={x + 29} y={y + 14} textAnchor="middle" fontSize="12" fontWeight="700" fill={dark ? "#fff" : "#334155"}>
        {children}
      </text>
    </g>
  );
}

export function SettleExplainer({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Same dialog manners as the rest of the app (see BillDetailsButton):
  // Escape closes, and the page behind stops scrolling while it's up.
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settle-explainer-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/55"
      />
      <div className="card relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-b-none rounded-t-3xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
        <h2 id="settle-explainer-title" className="text-lg font-bold text-slate-900">
          How simplified settle up works
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Nobody pays more or less. The app just finds a shorter route for the same money.
        </p>

        <Step n={1} title="Say your house has 5 debts">
          <svg viewBox="0 0 420 190" className="mx-auto block w-full max-w-[320px]">
            <defs>
              <marker id="se-grey" markerWidth="8" markerHeight="8" refX="6.6" refY="2.8" orient="auto">
                <path d="M0,0 L6.6,2.8 L0,5.6 z" fill="#94a3b8" />
              </marker>
            </defs>
            <g stroke="#94a3b8" strokeWidth="2" markerEnd="url(#se-grey)">
              <line x1="105" y1="46" x2="315" y2="46" />
              <line x1="109" y1="58" x2="311" y2="133" />
              <line x1="78" y1="117" x2="78" y2="73" />
              <line x1="342" y1="73" x2="342" y2="117" />
              <line x1="315" y1="144" x2="105" y2="144" />
            </g>
            <AmountTag x={181} y={36}>£42.50</AmountTag>
            <AmountTag x={181} y={85}>£18.00</AmountTag>
            <AmountTag x={49} y={85}>£35.20</AmountTag>
            <AmountTag x={313} y={85}>£12.00</AmountTag>
            <AmountTag x={181} y={134}>£22.40</AmountTag>
            <People />
          </svg>
        </Step>

        <Step n={2} title="Only your net has to move">
          <div className="space-y-1 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
            <p className="flex justify-between font-medium text-slate-600">
              <span>You owe out</span>
              <span className="font-semibold text-slate-900">£60.50</span>
            </p>
            <p className="flex justify-between font-medium text-slate-600">
              <span>You are owed in</span>
              <span className="font-semibold text-slate-900">£35.20</span>
            </p>
            <p className="mt-1 flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
              <span>Actually leaves your account</span>
              <span className="text-base font-bold text-brand-600">£25.30</span>
            </p>
          </div>
        </Step>

        <Step n={3} title="So the payments get re-routed">
          <svg viewBox="0 0 420 190" className="mx-auto block w-full max-w-[320px]">
            <defs>
              <marker id="se-brand" markerWidth="8" markerHeight="8" refX="6.6" refY="2.8" orient="auto">
                <path d="M0,0 L6.6,2.8 L0,5.6 z" fill="#5f3fe0" />
              </marker>
            </defs>
            <g stroke="#5f3fe0" strokeWidth="2.5" markerEnd="url(#se-brand)">
              <line x1="105" y1="46" x2="315" y2="46" />
              <line x1="109" y1="133" x2="311" y2="58" />
              <line x1="105" y1="144" x2="315" y2="144" />
            </g>
            <AmountTag x={181} y={36} dark>£25.30</AmountTag>
            <AmountTag x={184} y={85} dark>£5.20</AmountTag>
            <AmountTag x={184} y={134} dark>£7.60</AmountTag>
            <People />
          </svg>
        </Step>

        <div className="mt-4 flex gap-2.5 rounded-2xl border border-mint-100 bg-mint-50 px-4 py-3">
          <span className="shrink-0 font-bold text-mint-600">✓</span>
          <p className="text-xs font-medium leading-relaxed text-slate-600">
            Sam is still £30.50 up: £25.30 from you and £5.20 from Priya. Everyone lands on
            exactly the same number as before, in 3 payments instead of 5.
          </p>
        </div>

        <button type="button" onClick={onClose} className="btn-primary btn-block mt-4">
          Got it
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
          {n}
        </span>
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
