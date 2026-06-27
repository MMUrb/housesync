import { SkeletonPageTitle, SkeletonListCard } from "@/components/Skeleton";

// Neutral fallback for app screens without a tailored skeleton
// (settings, categories, new-item forms, housemate detail).
export default function Loading() {
  return (
    <div>
      <SkeletonPageTitle subtitle />
      <SkeletonListCard rows={4} />
    </div>
  );
}
