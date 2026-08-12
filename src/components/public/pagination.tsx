import Link from "next/link";

type PaginationProps = {
  page: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, string | undefined>;
};

function buildHref(
  basePath: string,
  page: number,
  query: Record<string, string | undefined> = {},
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({
  page,
  totalPages,
  basePath,
  query = {},
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(basePath, page - 1, query)}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Previous
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={buildHref(basePath, page + 1, query)}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}
