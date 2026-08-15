import { Skeleton } from "@/components/ui/skeleton";

type PublicPageLoadingProps = {
  variant?: "catalog" | "detail" | "generic" | "home";
};

function HeaderSkeleton() {
  return (
    <div className="border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-7 w-36" />
        <div className="hidden items-center gap-6 md:flex">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-9 w-9 rounded-md md:hidden" />
      </div>
    </div>
  );
}

function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="border-b border-border/60 bg-card/40">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:px-8 lg:py-16">
          <div className="space-y-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-12 w-full max-w-xl" />
            <Skeleton className="h-12 w-4/5 max-w-lg" />
            <Skeleton className="h-5 w-full max-w-md" />
            <Skeleton className="mt-4 h-12 w-full max-w-xl rounded-lg" />
            <div className="flex flex-wrap gap-2 pt-2">
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
          </div>
          <Skeleton className="hidden aspect-[4/3] w-full rounded-2xl lg:block" />
        </div>
      </div>
      <div className="border-b border-border/50">
        <div className="mx-auto flex max-w-7xl gap-6 overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-56" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <CourseCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function CatalogSkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="mb-7 h-11 w-full rounded-lg" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <CourseCardSkeleton key={index} />
        ))}
      </div>
    </main>
  );
}

function DetailSkeleton() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="mb-8 h-4 w-56" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Skeleton className="h-9 w-full max-w-2xl" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="aspect-[16/9] w-full rounded-xl" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
        <div className="h-fit space-y-4 rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </main>
  );
}

function GenericSkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-5 w-full max-w-2xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </main>
  );
}

export function PublicPageLoading({
  variant = "generic",
}: PublicPageLoadingProps) {
  return (
    <div aria-busy="true" aria-live="polite" role="status">
      <span className="sr-only">Đang tải trang</span>
      <HeaderSkeleton />
      {variant === "home" ? (
        <HomeSkeleton />
      ) : variant === "catalog" ? (
        <CatalogSkeleton />
      ) : variant === "detail" ? (
        <DetailSkeleton />
      ) : (
        <GenericSkeleton />
      )}
    </div>
  );
}
