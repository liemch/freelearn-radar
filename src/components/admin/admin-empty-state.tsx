import type { ReactNode } from "react";

type AdminEmptyStateProps = {
  message: string;
  /** Why the list is empty, when that is not obvious from the message alone. */
  hint?: string;
  action?: ReactNode;
};

/** Low-key by design: an empty admin list is usually normal, not a problem. */
export function AdminEmptyState({
  message,
  hint,
  action,
}: AdminEmptyStateProps) {
  return (
    <div className="px-3.5 py-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {hint ? (
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground/80">
          {hint}
        </p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
