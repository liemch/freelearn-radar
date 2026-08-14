"use client";

import { useState } from "react";

type WatchCourseFormProps = {
  courseId: string;
  locale: string;
  labels: {
    heading: string;
    email: string;
    submit: string;
    submitting: string;
    success: string;
    error: string;
  };
};

export function WatchCourseForm({
  courseId,
  locale,
  labels,
}: WatchCourseFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    try {
      const response = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, email, locale }),
      });
      if (!response.ok) {
        setStatus("error");
        return;
      }
      setStatus("ok");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <h3 className="text-sm font-semibold">{labels.heading}</h3>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">{labels.email}</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          autoComplete="email"
        />
      </label>
      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {status === "loading" ? labels.submitting : labels.submit}
      </button>
      {status === "ok" ? (
        <p className="text-sm text-emerald-700" role="status">
          {labels.success}
        </p>
      ) : null}
      {status === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {labels.error}
        </p>
      ) : null}
    </form>
  );
}
