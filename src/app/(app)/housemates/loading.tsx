import { Skeleton, SkeletonPageTitle, SkeletonHeading, SkeletonListCard } from "@/components/Skeleton";

// House name + count (no action), then Settle up, the members list and Invite.
export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonPageTitle subtitle action={false} />
      <div className="space-y-2">
        <SkeletonHeading />
        <SkeletonListCard rows={2} />
      </div>
      <div className="space-y-2">
        <SkeletonHeading />
        <SkeletonListCard rows={4} />
      </div>
      <div className="space-y-2">
        <SkeletonHeading />
        <div className="card p-4">
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
