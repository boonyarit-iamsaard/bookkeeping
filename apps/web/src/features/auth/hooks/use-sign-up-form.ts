"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as z from "zod";
import { authClient } from "@/core/auth/client";

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
  const router = useRouter();
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

      router.push("/dashboard");
      router.refresh();
    },
  });

  return { form, serverError };
}
