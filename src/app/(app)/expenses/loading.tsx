import { Skeleton, SkeletonPageTitle, SkeletonListCard } from "@/components/Skeleton";

// Title + "Add", the category filter chips, then the expense list.
export default function Loading() {
  return (
    <div>
      <SkeletonPageTitle />
      <div className="mb-3 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <SkeletonListCard rows={6} />
    </div>
  );
}
