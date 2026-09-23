"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import * as z from "zod";
import { authClient } from "@/core/auth/client";
import { resetSessionCache } from "@/core/auth/session";
import { completeProvisioning } from "@/features/auth/complete-provisioning";

// Mirrors Better Auth's default password bounds.
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.email("Enter a valid email address"),
    password: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      )
      .max(
        PASSWORD_MAX_LENGTH,
        `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export function useSignUpForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: signUpSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(null);

      const { error } = await authClient.signUp.email({
        name: value.name.trim(),
        email: value.email,
        password: value.password,
      });

      if (error) {
        setServerError(
          error.message ?? "Unable to create account. Please try again.",
        );
        return;
      }

      await completeProvisioning();
      resetSessionCache(queryClient);
      await navigate({ to: "/" });
    },
  });

  return { form, serverError };
}
