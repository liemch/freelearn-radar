import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { UserRole } from "@/domain/course/types";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/constants";
import {
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
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
