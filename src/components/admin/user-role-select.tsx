"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type UserRoleSelectProps = {
  userId: string;
  role: "ADMIN" | "EDITOR";
  labels: {
    updateFailed: string;
    lastAdmin: string;
  };
};

export function UserRoleSelect({
  userId,
  role,
  labels,
}: UserRoleSelectProps) {
  const router = useRouter();
  const [value, setValue] = useState(role);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onChange(next: "ADMIN" | "EDITOR") {
    setError(null);
    const previous = value;
    setValue(next);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      if (!response.ok) {
        setValue(previous);
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        const msg = payload.error || labels.updateFailed;
        setError(
          msg.toLowerCase().includes("last admin")
            ? labels.lastAdmin
            : msg,
        );
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setValue(previous);
      setError(labels.updateFailed);
    }
  }

  return (
    <div className="space-y-1">
      <select
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value as "ADMIN" | "EDITOR")}
      >
        <option value="ADMIN">ADMIN</option>
        <option value="EDITOR">EDITOR</option>
      </select>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
