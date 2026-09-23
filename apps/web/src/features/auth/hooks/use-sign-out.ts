"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/core/auth/client";
import { resetSessionCache } from "@/core/auth/session";

/**
 * Ends the session for either account control: every cached read goes with
 * it, and the app returns to sign-in. A failure leaves the control usable.
 */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  async function signOut() {
    setIsPending(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          resetSessionCache(queryClient);
          void navigate({ to: "/sign-in" });
        },
        onError: () => {
          setIsPending(false);
        },
      },
    });
  }

  return { signOut, isPending };
}
