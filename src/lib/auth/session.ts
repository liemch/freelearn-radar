import { SignJWT, jwtVerify } from "jose";

import type { UserRole } from "@/domain/course/types";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/constants";
import { getServerEnv } from "@/lib/env";

export type SessionPayload = {
  userId: string;
  email: string;
  role: UserRole;
  /**
   * Value of `users.session_version` when the token was minted. Tokens issued
   * before this claim existed are treated as version 1, so adding it does not
   * sign everyone out on deploy.
   */
  sessionVersion?: number;
};

export const DEFAULT_SESSION_VERSION = 1;

function getAuthSecretKey() {
  const env = getServerEnv();

  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters");
  }

  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function createSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
    sv: payload.sessionVersion ?? DEFAULT_SESSION_VERSION,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getAuthSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecretKey(), {
      algorithms: ["HS256"],
    });

    if (typeof payload.sub !== "string") {
      return null;
    }

    if (typeof payload.email !== "string") {
      return null;
    }

    if (payload.role !== "ADMIN" && payload.role !== "EDITOR") {
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      sessionVersion:
        typeof payload.sv === "number" ? payload.sv : DEFAULT_SESSION_VERSION,
    };
  } catch {
    return null;
  }
}
