"use client";

// Re-opens the first-run walkthrough (the Walkthrough component in the app
// layout listens for this event).
export function TourButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("hs:open-tour"))}
      className="card flex w-full items-center justify-between p-4 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
    >
      <div>
        <p className="text-sm font-medium text-slate-800">Show me around</p>
        <p className="text-xs text-slate-500">Replay the quick intro to HouseSync</p>
      </div>
      <span className="shrink-0 text-slate-300">↺</span>
    </button>
  );
}
