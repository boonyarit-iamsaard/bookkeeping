"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import * as z from "zod";
import { authClient } from "@/core/auth/client";
import { resetSessionCache } from "@/core/auth/session";
import { completeProvisioning } from "@/features/auth/complete-provisioning";

const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export function useSignInForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: signInSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(null);

      const { error } = await authClient.signIn.email({
        email: value.email,
        password: value.password,
      });

      if (error) {
        setServerError(error.message ?? "Unable to sign in. Please try again.");
        return;
      }

      await completeProvisioning();
      resetSessionCache(queryClient);
      await navigate({ to: "/wallets" });
    },
  });

  return { form, serverError };
}
