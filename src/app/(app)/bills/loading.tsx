import { Skeleton, SkeletonPageTitle } from "@/components/Skeleton";

// Title + subtitle + "Add", then a few bill cards (icon, amount, due line and
// the per-housemate paid status block).
export default function Loading() {
  return (
    <div>
      <SkeletonPageTitle subtitle />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-4 w-14 rounded" />
                </div>
                <Skeleton className="h-3 w-44 rounded" />
              </div>
            </div>
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-3 w-40 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
