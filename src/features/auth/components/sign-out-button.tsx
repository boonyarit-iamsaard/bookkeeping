"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/core/auth/client";
import { Button } from "@/shared/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut() {
    setIsPending(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in");
          router.refresh();
        },
        onError: () => {
          setIsPending(false);
        },
      },
    });
  }

  // Icon-only below 640px so the header fits a 360px phone; the name stays.
  return (
    <Button
      variant="outline"
      onClick={handleSignOut}
      disabled={isPending}
      className="max-sm:size-9 max-sm:px-0"
    >
      <LogOut aria-hidden="true" strokeWidth={1.75} className="sm:hidden" />
      <span className="max-sm:sr-only">
        {isPending ? "Signing out…" : "Sign out"}
      </span>
    </Button>
  );
}
