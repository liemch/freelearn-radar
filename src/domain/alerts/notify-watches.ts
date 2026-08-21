import { and, eq } from "drizzle-orm";

import type { Db } from "@/db";
import { courseWatches, courses, type CoursePriceEvent } from "@/db/schema";
import { deriveUnsubscribeToken } from "@/domain/alerts/watch-token";
import { recordApiUsage } from "@/domain/admin/api-usage";
import { writeAuditLog } from "@/domain/admin/audit-log";
import { getEmailProvider } from "@/services/email/email-provider";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { localePath } from "@/lib/i18n/path";
import type { Locale } from "@/lib/i18n/config";

export type NotifyWatchesSummary = {
  considered: number;
  sent: number;
  skipped: number;
  errors: number;
};

/**
 * For confirmed WENT_FREE events, notify CONFIRMED watches (best effort).
 * No-op unless FEATURE_PRICE_ALERTS === "true".
 */
export async function notifyWatchesForEvents(
  db: Db,
  events: CoursePriceEvent[],
): Promise<NotifyWatchesSummary> {
  const summary: NotifyWatchesSummary = {
    considered: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
  };

  const env = getServerEnv();
  if (env.FEATURE_PRICE_ALERTS !== "true") {
    return summary;
  }

  const wentFree = events.filter(
    (event) => event.eventType === "WENT_FREE" && event.confirmedAt != null,
  );

  if (wentFree.length === 0) {
    return summary;
  }

  const email = getEmailProvider();
  const appUrl = env.APP_URL.replace(/\/$/, "");
  // A single popular course going free must not be able to exhaust the whole
  // sending quota in one batch.
  let remainingBudget = env.EMAIL_DAILY_BUDGET;

  for (const event of wentFree) {
    const watches = await db
      .select()
      .from(courseWatches)
      .where(
        and(
          eq(courseWatches.courseId, event.courseId),
          eq(courseWatches.status, "CONFIRMED"),
        ),
      );

    if (watches.length === 0) {
      summary.skipped += 1;
      continue;
    }

    const courseRows = await db
      .select({ id: courses.id, title: courses.title, slug: courses.slug })
      .from(courses)
      .where(eq(courses.id, event.courseId))
      .limit(1);
    const course = courseRows[0];
    if (!course) {
      summary.skipped += 1;
      continue;
    }

    for (const watch of watches) {
      summary.considered += 1;

      if (remainingBudget <= 0) {
        summary.skipped += 1;
        logger.warn("alerts.notify.budget_exhausted", {
          watchId: watch.id,
          budget: env.EMAIL_DAILY_BUDGET,
        });
        continue;
      }

      const locale = (watch.locale === "vi" ? "vi" : "en") as Locale;
      const courseUrl = `${appUrl}${localePath(locale, `/course/${course.slug}`)}`;
      const unsubUrl = `${appUrl}/api/watches/unsubscribe?w=${encodeURIComponent(
        watch.id,
      )}&t=${deriveUnsubscribeToken(watch.id)}`;

      const subject =
        locale === "vi"
          ? `${course.title} vừa miễn phí trở lại`
          : `${course.title} is free again`;

      const text =
        locale === "vi"
          ? `Khóa học “${course.title}” vừa được đánh dấu miễn phí.\nXem: ${courseUrl}\nHủy đăng ký: ${unsubUrl}`
          : `“${course.title}” was just marked free again.\nView: ${courseUrl}\nUnsubscribe: ${unsubUrl}`;

      const html = `<p>${text.replace(/\n/g, "<br/>")}</p>`;

      try {
        const startedAt = Date.now();
        const result = await email.sendEmail({
          to: watch.email,
          subject,
          html,
          text,
          tags: ["COURSE_WENT_FREE"],
          listUnsubscribeUrl: unsubUrl,
        });

        await recordApiUsage(db, {
          kind: "email",
          provider: result.dryRun ? "dry_run" : "resend",
          operation: "watch_went_free",
          courseId: course.id,
          ok: result.ok,
          latencyMs: Date.now() - startedAt,
          workerVersion: env.MONITOR_WORKER_VERSION,
          error: result.ok ? null : (result.error ?? "send failed"),
        });

        if (!result.ok) {
          summary.errors += 1;
          logger.warn("alerts.notify.failed", {
            watchId: watch.id,
            error: result.error,
          });
          continue;
        }

        await db
          .update(courseWatches)
          .set({
            status: "NOTIFIED",
            notifiedAt: new Date(),
          })
          .where(eq(courseWatches.id, watch.id));

        await writeAuditLog(db, {
          actorType: "WORKER",
          actorId: env.MONITOR_WORKER_VERSION,
          action: "COURSE_WATCH_NOTIFIED",
          entityType: "course_watch",
          entityId: watch.id,
          before: { status: watch.status, notifiedAt: watch.notifiedAt },
          after: { status: "NOTIFIED" },
          reason: `notification for price event ${event.id}`,
        });

        summary.sent += 1;
        remainingBudget -= 1;
      } catch (error) {
        summary.errors += 1;
        logger.warn("alerts.notify.error", {
          watchId: watch.id,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }
  }

  logger.info("alerts.notify", { status: "done", ...summary });
  return summary;
}
