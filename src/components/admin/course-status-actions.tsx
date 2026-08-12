"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CourseStatus } from "@/domain/course/types";

type CourseStatusActionsProps = {
  courseId: string;
  status: CourseStatus;
};

export function CourseStatusActions({
  courseId,
  status,
}: CourseStatusActionsProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(nextStatus: CourseStatus) {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/courses/${courseId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Status update failed");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to update status");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== "PUBLISHED" ? (
          <Button
            size="sm"
            disabled={isSubmitting}
            onClick={() => updateStatus("PUBLISHED")}
          >
            Publish
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => updateStatus("DRAFT")}
          >
            Unpublish
          </Button>
        )}
        {status !== "ARCHIVED" ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={isSubmitting}
            onClick={() => updateStatus("ARCHIVED")}
          >
            Archive
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
