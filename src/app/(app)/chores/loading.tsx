import { SkeletonPageTitle, SkeletonHeading, SkeletonListCard } from "@/components/Skeleton";

// Title + subtitle + "Add", then a couple of grouped chore sections.
export default function Loading() {
  return (
    <div>
      <SkeletonPageTitle subtitle />
      <div className="space-y-5">
        <div className="space-y-2">
          <SkeletonHeading />
          <SkeletonListCard rows={2} />
        </div>
        <div className="space-y-2">
          <SkeletonHeading />
          <SkeletonListCard rows={3} />
        </div>
      </div>
    </div>
  );
}
