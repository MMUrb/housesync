// Shown instantly while an app page's data loads — makes navigation feel snappy.
export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-7 w-44 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid grid-cols-2 gap-3">
        <div className="card h-[84px] animate-pulse" />
        <div className="card h-[84px] animate-pulse" />
      </div>
      <div className="card h-44 animate-pulse" />
      <div className="card h-32 animate-pulse" />
    </div>
  );
}
