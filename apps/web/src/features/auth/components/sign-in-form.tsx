"use client";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { signUpQuery } from "@/core/auth/sign-up";
import { useSignInForm } from "@/features/auth/hooks/use-sign-in-form";
import { ErrorNotice } from "@/shared/components/error-notice";
import { Button, linkActionClass } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/helpers/cn";

export function SignInForm(props: Readonly<React.ComponentProps<typeof Card>>) {
  const { form, serverError } = useSignInForm();
  const { data: signUpStatus } = useQuery(signUpQuery());

  return (
    <Card
      {...props}
      className={cn("sm:[--card-spacing:--spacing(7)]", props.className)}
    >
      <CardHeader>
        <CardTitle className="text-[1.625rem] leading-tight tracking-[-0.02em]">
          Sign in to your account
        </CardTitle>
        <CardDescription>
          Enter your email below to sign in to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="email">
              {(field) => (
                <Field data-invalid={!field.state.meta.isValid}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    autoComplete="email"
                    placeholder="m@example.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={!field.state.meta.isValid}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="password">
              {(field) => (
                <Field data-invalid={!field.state.meta.isValid}>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="current-password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={!field.state.meta.isValid}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Field>
                  {serverError && <ErrorNotice>{serverError}</ErrorNotice>}
                  <Button type="submit" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? "Signing in…" : "Sign in"}
                  </Button>
                  {signUpStatus === "open" && (
                    <>
                      <FieldDescription className="text-center">
                        Don&apos;t have an account?
                      </FieldDescription>
                      <Link to="/sign-up" className={linkActionClass}>
                        Sign up
                      </Link>
                    </>
                  )}
                </Field>
              )}
            </form.Subscribe>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
