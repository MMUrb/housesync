import { Skeleton, SkeletonHeading, SkeletonListCard } from "@/components/Skeleton";

// Mirrors the dashboard: greeting, balance pair, spending, quick actions and
// the first list section, so the screen looks settled the instant you land.
export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44 rounded" />
        <Skeleton className="h-4 w-56 rounded" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card space-y-2 p-4">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-7 w-24 rounded" />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <SkeletonHeading />
        <div className="card h-28 animate-pulse" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card flex flex-col items-center gap-2 p-3">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-14 rounded" />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <SkeletonHeading link />
        <SkeletonListCard rows={2} />
      </div>
    </div>
  );
}
