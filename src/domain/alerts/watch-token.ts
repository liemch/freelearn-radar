import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env";

/** A confirmation link is a one-shot action; two days is generous for a human. */
export const CONFIRM_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

export function generateWatchToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Confirm tokens are stored as a digest, so a database read yields no working
 * links. The token itself is high-entropy random, so a plain SHA-256 is enough —
 * there is no low-entropy input to brute-force.
 */
export function hashWatchToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Unsubscribe links must work in every alert email, months after signup, so the
 * token cannot be a one-way hash of something we discard. Deriving it from the
 * watch id means nothing is stored at all: the database holds no credential, and
 * the link is still verifiable by recomputation.
 */
export function deriveUnsubscribeToken(watchId: string): string {
  const secret = getServerEnv().AUTH_SECRET || "freelearn-radar-dev-secret";
  return createHmac("sha256", secret)
    .update(`unsubscribe:${watchId}`)
    .digest("hex");
}

export function verifyUnsubscribeToken(
  watchId: string,
  token: string,
): boolean {
  const expected = deriveUnsubscribeToken(watchId);
  const provided = token.trim();

  // Length check first: timingSafeEqual throws on a length mismatch.
  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export function isConfirmTokenExpired(createdAt: Date, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() > CONFIRM_TOKEN_TTL_MS;
}
