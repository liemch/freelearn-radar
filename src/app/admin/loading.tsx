import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div aria-busy role="status">
      <span className="sr-only">Đang tải</span>
      <div className="mb-4 space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3.5 w-72" />
      </div>
      {/* One panel-shaped block: header rule plus a few rows, matching the
          density of a loaded admin panel rather than a stack of tall cards. */}
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="border-b border-border px-3.5 py-2.5">
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="divide-y divide-border/60">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5"
            >
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
