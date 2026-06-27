import { Skeleton } from "@/components/Skeleton";

// Roughly mirrors the chat thread: alternating message bubbles with a composer
// pinned at the bottom. Shows only briefly while messages load.
export default function Loading() {
  const widths = ["w-40", "w-52", "w-32", "w-56", "w-44", "w-36"];
  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="flex-1 space-y-3">
        {widths.map((w, i) => (
          <div key={i} className={i % 2 ? "flex justify-end" : "flex justify-start"}>
            <Skeleton className={`h-10 ${w} max-w-[80%] rounded-2xl`} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="h-11 flex-1 rounded-full" />
        <Skeleton className="h-11 w-16 rounded-full" />
      </div>
    </div>
  );
}
