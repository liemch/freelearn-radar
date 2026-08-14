"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CourseStatus, PriceType } from "@/domain/course/types";
import { isEligibleForFreeLists } from "@/domain/course/free-durability";

type CourseStatusActionsLabels = {
  publish: string;
  unpublish: string;
  archive: string;
  statusUpdateFailed: string;
  unableToUpdateStatus: string;
  publishBlockedHint: string;
};

type CourseStatusActionsProps = {
  courseId: string;
  status: CourseStatus;
  priceType: PriceType;
  labels: CourseStatusActionsLabels;
};

export function CourseStatusActions({
  courseId,
  status,
  priceType,
  labels,
}: CourseStatusActionsProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canPublishPublicly = isEligibleForFreeLists(priceType);

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
        setError(body.error ?? labels.statusUpdateFailed);
        return;
      }

      router.refresh();
    } catch {
      setError(labels.unableToUpdateStatus);
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
            disabled={isSubmitting || !canPublishPublicly}
            title={
              canPublishPublicly
                ? undefined
                : labels.publishBlockedHint
            }
            onClick={() => updateStatus("PUBLISHED")}
          >
            {labels.publish}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => updateStatus("DRAFT")}
          >
            {labels.unpublish}
          </Button>
        )}
        {status !== "ARCHIVED" ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={isSubmitting}
            onClick={() => updateStatus("ARCHIVED")}
          >
            {labels.archive}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
