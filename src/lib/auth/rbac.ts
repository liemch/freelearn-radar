import { NextResponse } from "next/server";

import {
  forbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/guards";
import type { SessionPayload } from "@/lib/auth/session";

export class AuthzError extends Error {
  constructor(
    readonly kind: "UNAUTHORIZED" | "FORBIDDEN",
    message?: string,
  ) {
    super(message ?? kind);
    this.name = "AuthzError";
  }
}

/** Require an authenticated ADMIN session. */
export function assertAdmin(
  session: SessionPayload | null,
): asserts session is SessionPayload {
  if (!session) {
    throw new AuthzError("UNAUTHORIZED");
  }
  if (session.role !== "ADMIN") {
    throw new AuthzError("FORBIDDEN", "ADMIN role required");
  }
}

/** Require ADMIN or EDITOR. */
export function assertEditor(
  session: SessionPayload | null,
): asserts session is SessionPayload {
  if (!session) {
    throw new AuthzError("UNAUTHORIZED");
  }
  if (session.role !== "ADMIN" && session.role !== "EDITOR") {
    throw new AuthzError("FORBIDDEN", "ADMIN or EDITOR role required");
  }
}

export function authzResponse(error: unknown): NextResponse | null {
  if (!(error instanceof AuthzError)) {
    return null;
  }
  if (error.kind === "UNAUTHORIZED") {
    return unauthorizedResponse();
  }
  return forbiddenResponse(error.message);
}
