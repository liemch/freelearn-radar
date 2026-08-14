"use client";

import type { ComponentProps, FormEvent } from "react";
import { useRouter } from "nextjs-toploader/app";

type SoftGetFormProps = Omit<
  ComponentProps<"form">,
  "action" | "method" | "onSubmit"
> & {
  action: string;
};

export function buildSoftGetHref(
  action: string,
  formData: FormData,
  origin: string,
): string {
  const destination = new URL(action, origin);
  destination.search = "";

  for (const [key, rawValue] of formData.entries()) {
    if (typeof rawValue !== "string") continue;
    const value = rawValue.trim();
    if (value) destination.searchParams.append(key, value);
  }

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

/**
 * GET form that preserves shareable query URLs while navigating through the
 * App Router, so route loading UI and the global progress bar can respond.
 */
export function SoftGetForm({
  action,
  children,
  ...props
}: SoftGetFormProps) {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      buildSoftGetHref(
        action,
        new FormData(event.currentTarget),
        window.location.origin,
      ),
    );
  }

  return (
    <form {...props} action={action} method="get" onSubmit={handleSubmit}>
      {children}
    </form>
  );
}
