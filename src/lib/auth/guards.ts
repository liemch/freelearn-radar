import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { findUserById } from "@/db/repositories/user-repository";
import type { UserRole } from "@/domain/course/types";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/constants";
import {
  createSessionToken,
  verifySessionToken,
  DEFAULT_SESSION_VERSION,
  type SessionPayload,
} from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * A signed JWT cannot express "this account was deleted, demoted, or revoked",
 * so an authenticated request re-reads the user row and treats the database as
 * authoritative for role and session version.
 *
 * A database failure falls back to the token instead of rejecting: locking every
 * operator out of the console during a Neon incident is worse than briefly
 * honouring a session a reachable database would have refused.
 */
async function resolveActiveSession(
  session: SessionPayload,
): Promise<SessionPayload | null> {
  try {
    const user = await findUserById(getDb(), session.userId);

    if (!user) {
      return null;
    }

    const currentVersion = user.sessionVersion ?? DEFAULT_SESSION_VERSION;
    if (currentVersion !== (session.sessionVersion ?? DEFAULT_SESSION_VERSION)) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionVersion: currentVersion,
    };
  } catch (error) {
    logger.warn("auth.session.revocation_check_degraded", {
      userId: session.userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return session;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return null;
  }

  return resolveActiveSession(session);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();

  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  return session;
}

export function requireRole(
  session: SessionPayload,
  allowedRoles: UserRole[],
): void {
  if (!allowedRoles.includes(session.role)) {
    throw new Error("FORBIDDEN");
  }
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  const env = getServerEnv();
  const secure = env.APP_URL.startsWith("https://");

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function unauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}
