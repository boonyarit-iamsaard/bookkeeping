import { createFileRoute, redirect } from "@tanstack/react-router";
import { readSignUp } from "@/core/auth/sign-up";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export const Route = createFileRoute("/_auth/sign-up")({
  beforeLoad: async ({ context }) => {
    if ((await readSignUp(context.queryClient)) !== "open") {
      throw redirect({ to: "/sign-in" });
    }
  },
  head: () => ({ meta: [{ title: "Sign up" }] }),
  component: SignUpForm,
});
