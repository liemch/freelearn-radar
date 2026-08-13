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
      className="flex items-center justify-between gap-4 pt-2"
      aria-label="Pagination"
    >
      <p className="text-sm text-muted-foreground">{pageOf}</p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <LocalizedLink href={buildHref(basePath, page - 1, query)}>
              {previous}
            </LocalizedLink>
          </Button>
        ) : null}
        {page < totalPages ? (
          <Button asChild variant="outline" size="sm">
            <LocalizedLink href={buildHref(basePath, page + 1, query)}>
              {next}
            </LocalizedLink>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
