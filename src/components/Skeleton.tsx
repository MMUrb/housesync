// Pulsing placeholders rendered by route-level loading.tsx files while a
// screen's server data loads. Pure CSS (animate-pulse); the slate tones are
// remapped for night mode in globals.css, so these adapt automatically.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 ${className}`} aria-hidden="true" />;
}

// Mirrors the shared <PageTitle>: bold title (and optional subtitle) on the
// left, with an optional "Add" button on the right.
export function SkeletonPageTitle({
  subtitle = false,
  action = true,
}: {
  subtitle?: boolean;
  action?: boolean;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-6 w-32 rounded" />
        {subtitle && <Skeleton className="h-3.5 w-52 rounded" />}
      </div>
      {action && <Skeleton className="h-9 w-16 rounded-xl" />}
    </div>
  );
}

// A small section heading, optionally with a trailing "see all" link.
export function SkeletonHeading({ link = false }: { link?: boolean }) {
  return (
    <div className="flex items-center justify-between px-1">
      <Skeleton className="h-3.5 w-28 rounded" />
      {link && <Skeleton className="h-3 w-14 rounded" />}
    </div>
  );
}

// A .card of `rows` list items (avatar dot, two lines, trailing value), matching
// the list rows used across Home, Expenses, Bills and Housemates.
export function SkeletonListCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2 rounded" />
            <Skeleton className="h-3 w-1/3 rounded" />
          </div>
          <Skeleton className="h-4 w-12 shrink-0 rounded" />
        </div>
      ))}
    </div>
  );
}
