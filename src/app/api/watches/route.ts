import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { requestWatch } from "@/domain/alerts/watch-service";
import { getEmailProvider } from "@/services/email/email-provider";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  courseId: z.string().uuid(),
  email: z.string().email().max(320),
  locale: z.enum(["en", "vi"]).optional(),
});

export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    if (env.FEATURE_PRICE_ALERTS !== "true") {
      return NextResponse.json(
        { error: "Price alerts are disabled" },
        { status: 404 },
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const db = getDb();
    const watch = await requestWatch(db, parsed.data);

    // Double opt-in: send confirm email when still PENDING.
    if (watch.status === "PENDING" && watch.confirmToken) {
      const appUrl = env.APP_URL.replace(/\/$/, "");
      const confirmUrl = `${appUrl}/api/watches/confirm?token=${encodeURIComponent(watch.confirmToken)}`;
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
        await getEmailProvider().sendEmail({
          to: watch.email,
          subject,
          html: `<p><a href="${confirmUrl}">${text}</a></p>`,
          text,
          tags: ["CONFIRM_WATCH"],
        });
      } catch (error) {
        logger.warn("watches.confirm_email", {
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      status: watch.status,
    });
  } catch (error) {
    logger.error("watches.create", {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
