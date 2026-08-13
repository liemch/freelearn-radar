import { LocalizedLink } from "@/components/public/localized-link";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, string | undefined>;
  labels?: {
    pageOf: (page: number, total: number) => string;
    previous: string;
    next: string;
  };
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
  labels,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pageOf =
    labels?.pageOf?.(page, totalPages) ?? `Page ${page} of ${totalPages}`;
  const previous = labels?.previous ?? "Previous";
  const next = labels?.next ?? "Next";

  return (
    <nav
      className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      aria-label="Pagination"
    >
      <p className="text-sm text-muted-foreground">{pageOf}</p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-8">
            <LocalizedLink href={buildHref(basePath, page - 1, query)}>
              {previous}
            </LocalizedLink>
          </Button>
        ) : (
          <span className="sm:hidden" aria-hidden="true" />
        )}
        {page < totalPages ? (
          <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-8">
            <LocalizedLink href={buildHref(basePath, page + 1, query)}>
              {next}
            </LocalizedLink>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
