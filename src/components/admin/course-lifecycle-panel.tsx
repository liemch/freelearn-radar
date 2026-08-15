"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CourseStatus } from "@/domain/course/types";

type DependencySnapshot = {
  outboundClicks: number;
  observations: number;
  verifications: number;
  offers: number;
  watches: number;
  embeddings: number;
  affiliateClicks: number;
  productContexts: number;
  publishedAt: string | null;
  status: CourseStatus;
};

type Classification =
  | "SAFE_TO_PURGE"
  | "PURGE_WITH_SAFE_CASCADE"
  | "BLOCKED_BY_HISTORY";

type CourseLifecyclePanelProps = {
  courseId: string;
  slug: string;
  title: string;
  status: CourseStatus;
  duplicateOfCourseId: string | null;
  canPurge: boolean;
};

export function CourseLifecyclePanel({
  courseId,
  slug,
  title,
  status,
  duplicateOfCourseId,
  canPurge,
}: CourseLifecyclePanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deps, setDeps] = useState<DependencySnapshot | null>(null);
  const [classification, setClassification] = useState<Classification | null>(
    null,
  );
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [allowCascade, setAllowCascade] = useState(false);
  const [canonicalId, setCanonicalId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/admin/courses/${courseId}/lifecycle`,
        );
        if (!response.ok) return;
        const body = (await response.json()) as {
          dependencies: DependencySnapshot;
          classification: Classification;
        };
        if (cancelled) return;
        setDeps(body.dependencies);
        setClassification(body.classification);
      } catch {
        // ignore — panel still usable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function post(
    body: Record<string, unknown>,
    okMessage: string,
    redirectHome = false,
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/courses/${courseId}/lifecycle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Thao tác thất bại");
        return;
      }
      setMessage(okMessage);
      if (redirectHome) {
        router.push("/admin/courses");
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {status === "ARCHIVED" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void post({ action: "restore" }, "Đã khôi phục về nháp")
            }
          >
            Khôi phục
          </Button>
        </div>
      ) : null}

      {duplicateOfCourseId ? (
        <p className="text-xs text-muted-foreground">
          Đã đánh dấu trùng của{" "}
          <span className="font-mono">{duplicateOfCourseId}</span>
        </p>
      ) : status !== "ARCHIVED" ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[16rem] flex-1 space-y-1">
            <Label htmlFor="canonical">Đánh dấu trùng lặp (ID khóa gốc)</Label>
            <Input
              id="canonical"
              value={canonicalId}
              disabled={busy}
              placeholder="uuid khóa học chính"
              onChange={(event) => setCanonicalId(event.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !canonicalId.trim()}
            onClick={() =>
              void post(
                {
                  action: "duplicate",
                  canonicalCourseId: canonicalId.trim(),
                },
                "Đã lưu trữ như bản trùng",
              )
            }
          >
            Đánh dấu trùng lặp
          </Button>
        </div>
      ) : null}

      {deps ? (
        <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <div>Outbound clicks: {deps.outboundClicks}</div>
          <div>Watches: {deps.watches}</div>
          <div>Offers: {deps.offers}</div>
          <div>Observations: {deps.observations}</div>
          <div>Verifications: {deps.verifications}</div>
          <div>Embeddings: {deps.embeddings}</div>
          <div>Affiliate clicks: {deps.affiliateClicks}</div>
          <div>Product contexts: {deps.productContexts}</div>
          <div className="sm:col-span-2">
            Phân loại purge:{" "}
            <span className="font-medium text-foreground">
              {classification ?? "—"}
            </span>
          </div>
        </dl>
      ) : null}

      {canPurge && status === "ARCHIVED" ? (
        <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">
            Khu vực nguy hiểm — Xóa vĩnh viễn khóa học
          </p>
          <p className="text-xs text-muted-foreground">
            Gõ slug <span className="font-mono">{slug}</span> hoặc tiêu đề chính
            xác để xác nhận.
          </p>
          <div className="space-y-1">
            <Label htmlFor="confirm-purge">Xác nhận</Label>
            <Input
              id="confirm-purge"
              value={confirm}
              disabled={busy}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="purge-reason">Lý do xóa</Label>
            <Input
              id="purge-reason"
              value={reason}
              disabled={busy}
              placeholder="Ít nhất 8 ký tự"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          {classification === "PURGE_WITH_SAFE_CASCADE" ? (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={allowCascade}
                disabled={busy}
                onChange={(event) => setAllowCascade(event.target.checked)}
              />
              Cho phép cascade an toàn (xóa phụ thuộc kỹ thuật)
            </label>
          ) : null}
          <Button
            size="sm"
            variant="destructive"
            disabled={
              busy ||
              classification === "BLOCKED_BY_HISTORY" ||
              (confirm !== slug && confirm !== title) ||
              reason.trim().length < 8
            }
            onClick={() =>
              void post(
                {
                  action: "purge",
                  confirmSlug: confirm,
                  reason: reason.trim(),
                  allowCascade,
                },
                "Đã xóa vĩnh viễn",
                true,
              )
            }
          >
            Xóa vĩnh viễn
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
    </div>
  );
}
