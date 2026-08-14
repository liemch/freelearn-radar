import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LocaleHtmlLang } from "@/components/public/locale-html-lang";
import { LocalizedLink } from "@/components/public/localized-link";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { buildLearningPath } from "@/domain/search/learning-path";
import { getServerEnv } from "@/lib/env";
import { resolveLocaleParam } from "@/lib/i18n/page";

type PathPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function learningPathsEnabled(): boolean {
  try {
    return getServerEnv().FEATURE_LEARNING_PATHS === "true";
  } catch {
    return process.env.FEATURE_LEARNING_PATHS === "true";
  }
}

export async function generateMetadata({
  params,
}: PathPageProps): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);

  if (!learningPathsEnabled()) {
    return {
      title: "Not found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title:
      locale === "vi"
        ? "Lộ trình học | FreeLearn Radar"
        : "Learning Path | FreeLearn Radar",
    robots: { index: false, follow: true },
  };
}

export default async function LearningPathPage({
  params,
  searchParams,
}: PathPageProps) {
  const locale = await resolveLocaleParam(params);

  if (!learningPathsEnabled()) {
    notFound();
  }

  const raw = await searchParams;
  const goalParam = Array.isArray(raw.goal) ? raw.goal[0] : raw.goal;
  const goal = goalParam?.trim() ?? "";
  const path = goal ? buildLearningPath(goal) : null;
  const vi = locale === "vi";

  return (
    <main className="min-h-screen bg-background">
      <LocaleHtmlLang locale={locale} />
      <SiteHeader locale={locale} />
      <PageShell>
        <div className="space-y-6 py-8">
          <header className="space-y-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {vi ? "Lộ trình học" : "Learning path"}
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              {vi
                ? "Nhập mục tiêu học của bạn để nhận lộ trình từng bước với các truy vấn tìm khóa học miễn phí."
                : "Enter a learning goal to get a step-by-step outline with searches for free courses."}
            </p>
          </header>

          <form method="get" className="flex max-w-xl gap-2">
            <input
              type="text"
              name="goal"
              defaultValue={goal}
              placeholder={
                vi ? "Ví dụ: học Python cơ bản" : "e.g. learn Python basics"
              }
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit">
              {vi ? "Tạo lộ trình" : "Build path"}
            </Button>
          </form>

          {goal && !path ? (
            <p className="text-sm text-muted-foreground" role="status">
              {vi
                ? "Không thể tạo lộ trình từ mục tiêu này. Hãy thử mô tả cụ thể hơn."
                : "Could not build a path from this goal. Try a more specific description."}
            </p>
          ) : null}

          {path ? (
            <section className="space-y-4" aria-label={vi ? "Các bước" : "Steps"}>
              <ol className="space-y-3">
                {path.steps.map((step, index) => (
                  <li
                    key={step.title}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {vi ? `Bước ${index + 1}` : `Step ${index + 1}`}
                    </p>
                    <h2 className="mt-1 text-base font-semibold">
                      {step.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <LocalizedLink
                        href={`/search?q=${encodeURIComponent(step.query)}`}
                        className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent"
                      >
                        {vi
                          ? `Tìm khóa học: ${step.query}`
                          : `Search courses: ${step.query}`}
                      </LocalizedLink>
                      {step.topicSlug ? (
                        <LocalizedLink
                          href={`/free-courses/${step.topicSlug}`}
                          className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent"
                        >
                          {vi ? "Trang chủ đề" : "Topic page"}
                        </LocalizedLink>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">
                {vi
                  ? "Các bước chưa gắn khóa học cụ thể — hãy dùng liên kết tìm kiếm để xem khóa học miễn phí hiện có."
                  : "Steps do not pin specific courses yet — use the search links to see currently available free courses."}
              </p>
            </section>
          ) : null}
        </div>
      </PageShell>
      <SiteFooter locale={locale} />
    </main>
  );
}
