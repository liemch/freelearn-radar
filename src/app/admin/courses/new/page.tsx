import Link from "next/link";
import { redirect } from "next/navigation";

import { CourseForm } from "@/components/admin/course-form";
import { getDb } from "@/db";
import { listCategories } from "@/db/repositories/category-repository";
import { listProviders } from "@/db/repositories/provider-repository";
import { getSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminNewCoursePage() {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }

  let providers: Awaited<ReturnType<typeof listProviders>> = [];
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  let databaseReady = true;

  try {
    const db = getDb();
    [providers, categories] = await Promise.all([
      listProviders(db, false),
      listCategories(db),
    ]);
  } catch {
    databaseReady = false;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <p className="text-sm text-muted-foreground">
            <Link href="/admin/courses" className="hover:underline">
              Courses
            </Link>{" "}
            / New
          </p>
          <h1 className="text-xl font-semibold">Create course</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {!databaseReady || providers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Seed providers/categories before creating courses.
          </p>
        ) : (
          <CourseForm
            mode="create"
            providers={providers}
            categories={categories}
          />
        )}
      </main>
    </div>
  );
}
