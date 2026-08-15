"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CourseImageSourceType, CourseImageStatus } from "@/domain/course/types";

type CourseImagePanelProps = {
  courseId: string;
  displayUrl: string | null;
  imageSourceType: CourseImageSourceType;
  imageStatus: CourseImageStatus;
  imageSourceUrl: string | null;
  imageOverrideUrl: string | null;
  imageCheckedAt: string | null;
  imageFallbackReason: string | null;
};

export function CourseImagePanel({
  courseId,
  displayUrl,
  imageSourceType,
  imageStatus,
  imageSourceUrl,
  imageOverrideUrl,
  imageCheckedAt,
  imageFallbackReason,
}: CourseImagePanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function run(
    action: () => Promise<Response>,
    okMessage: string,
  ): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await action();
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Thao tác ảnh thất bại");
        return;
      }
      setMessage(okMessage);
      setUrl("");
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <div className="overflow-hidden rounded-md border bg-muted/40">
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt="Ảnh khóa học"
              className="aspect-video h-full w-full object-cover"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center text-xs text-muted-foreground">
              Không có ảnh
            </div>
          )}
        </div>
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Nguồn ảnh</dt>
            <dd className="font-medium">{imageSourceType}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Trạng thái</dt>
            <dd className="font-medium">{imageStatus}</dd>
          </div>
          {imageSourceUrl ? (
            <div>
              <dt className="text-xs text-muted-foreground">URL nguồn</dt>
              <dd className="break-all font-mono text-xs">{imageSourceUrl}</dd>
            </div>
          ) : null}
          {imageOverrideUrl ? (
            <div>
              <dt className="text-xs text-muted-foreground">Override Admin</dt>
              <dd className="break-all font-mono text-xs">{imageOverrideUrl}</dd>
            </div>
          ) : null}
          {imageCheckedAt ? (
            <div>
              <dt className="text-xs text-muted-foreground">Kiểm tra lần cuối</dt>
              <dd className="text-xs">
                {new Date(imageCheckedAt).toLocaleString("vi-VN")}
              </dd>
            </div>
          ) : null}
          {imageFallbackReason ? (
            <div>
              <dt className="text-xs text-muted-foreground">Lý do fallback</dt>
              <dd className="text-xs">{imageFallbackReason}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const form = new FormData();
              form.set("action", "upload");
              form.set("file", file);
              void run(
                () =>
                  fetch(`/api/admin/courses/${courseId}/image`, {
                    method: "PATCH",
                    body: form,
                  }),
                "Đã tải ảnh lên",
              );
              event.target.value = "";
            }}
          />
          <Button asChild size="sm" variant="outline" disabled={busy}>
            <span>Tải ảnh lên</span>
          </Button>
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(
              () =>
                fetch(`/api/admin/courses/${courseId}/image`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "resolve" }),
                }),
              "Đã lấy lại ảnh từ nguồn",
            )
          }
        >
          Lấy lại ảnh từ nguồn
        </Button>
        {imageOverrideUrl ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  fetch(`/api/admin/courses/${courseId}/image`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "clear" }),
                  }),
                "Đã xóa ảnh tùy chỉnh",
              )
            }
          >
            Xóa ảnh tùy chỉnh
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1 space-y-1">
          <Label htmlFor="image-url">Nhập URL ảnh</Label>
          <Input
            id="image-url"
            value={url}
            placeholder="https://…"
            disabled={busy}
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>
        <Button
          size="sm"
          disabled={busy || !url.trim()}
          onClick={() =>
            void run(
              () =>
                fetch(`/api/admin/courses/${courseId}/image`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "set_url", url: url.trim() }),
                }),
              "Đã đặt URL ảnh",
            )
          }
        >
          Lưu URL
        </Button>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
    </div>
  );
}
