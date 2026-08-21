"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type UserSessionRevokeButtonProps = {
  userId: string;
  labels: {
    action: string;
    done: string;
    failed: string;
  };
};

export function UserSessionRevokeButton({
  userId,
  labels,
}: UserSessionRevokeButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [pending, startTransition] = useTransition();

  async function onRevoke() {
    setState("idle");
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revokeSessions: true }),
      });

      if (!response.ok) {
        setState("error");
        return;
      }

      setState("done");
      startTransition(() => router.refresh());
    } catch {
      setState("error");
    }
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={onRevoke}
      >
        {labels.action}
      </Button>
      {state === "done" ? (
        <p className="text-xs text-muted-foreground">{labels.done}</p>
      ) : null}
      {state === "error" ? (
        <p className="text-xs text-destructive" role="alert">
          {labels.failed}
        </p>
      ) : null}
    </div>
  );
}
