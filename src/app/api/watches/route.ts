import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { recordApiUsage } from "@/domain/admin/api-usage";
import { requestWatch } from "@/domain/alerts/watch-service";
import { getEmailProvider } from "@/services/email/email-provider";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  courseId: z.string().uuid(),
  email: z.string().email().max(320),
  locale: z.enum(["en", "vi"]).optional(),
});

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 10;
const MAX_PER_EMAIL = 5;

/**
 * Identical for every outcome. Reporting the stored status would let a caller
 * probe whether an arbitrary address already watches a course.
 */
const OPAQUE_RESPONSE = { ok: true } as const;

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    if (env.FEATURE_PRICE_ALERTS !== "true") {
      return NextResponse.json(
        { error: "Price alerts are disabled" },
        { status: 404 },
      );
    }

    const ipCheck = checkRateLimit(
      `watch:ip:${clientKey(request)}`,
      MAX_PER_IP,
      WINDOW_MS,
    );
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(ipCheck.retryAfterMs / 1000)),
          },
        },
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // A second bucket keyed by address: without it, one attacker spread across
    // addresses could still flood a single inbox with confirmation mail.
    const emailCheck = checkRateLimit(
      `watch:email:${parsed.data.email.toLowerCase()}`,
      MAX_PER_EMAIL,
      WINDOW_MS,
    );
    if (!emailCheck.allowed) {
      return NextResponse.json(OPAQUE_RESPONSE);
    }

    const db = getDb();
    const { watch, confirmToken } = await requestWatch(db, parsed.data);

    // Double opt-in: send confirm email when still PENDING. A null token means
    // the address is already subscribed, so nothing is sent.
    if (watch.status === "PENDING" && confirmToken) {
      const appUrl = env.APP_URL.replace(/\/$/, "");
      const confirmUrl = `${appUrl}/api/watches/confirm?token=${encodeURIComponent(confirmToken)}`;
      const locale = parsed.data.locale === "vi" ? "vi" : "en";
      const subject =
        locale === "vi"
          ? "Xác nhận theo dõi khóa học"
          : "Confirm your course watch";
      const text =
        locale === "vi"
          ? `Nhấn để xác nhận theo dõi: ${confirmUrl}`
          : `Click to confirm your watch: ${confirmUrl}`;

      try {
        const startedAt = Date.now();
        const sent = await getEmailProvider().sendEmail({
          to: watch.email,
          subject,
          html: `<p><a href="${confirmUrl}">${text}</a></p>`,
          text,
          tags: ["CONFIRM_WATCH"],
        });

        await recordApiUsage(db, {
          kind: "email",
          provider: sent.dryRun ? "dry_run" : "resend",
          operation: "watch_confirm",
          courseId: parsed.data.courseId,
          ok: sent.ok,
          latencyMs: Date.now() - startedAt,
          error: sent.ok ? null : (sent.error ?? "send failed"),
        });
      } catch (error) {
        logger.warn("watches.confirm_email", {
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    return NextResponse.json(OPAQUE_RESPONSE);
  } catch (error) {
    logger.error("watches.create", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // Also opaque: "Course not found" would confirm which ids exist.
    return NextResponse.json(OPAQUE_RESPONSE);
  }
}
