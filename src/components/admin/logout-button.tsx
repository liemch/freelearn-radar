"use client";

import { useRouter } from "nextjs-toploader/app";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type AdminLogoutButtonProps = {
  label?: string;
  signingOutLabel?: string;
};

export function AdminLogoutButton({
  label = "Sign out",
  signingOutLabel = "Signing out...",
}: AdminLogoutButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setIsSubmitting(true);

    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogout}
      disabled={isSubmitting}
    >
      {isSubmitting ? signingOutLabel : label}
    </Button>
  );
}
