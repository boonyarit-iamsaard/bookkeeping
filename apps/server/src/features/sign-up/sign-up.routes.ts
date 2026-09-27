import { Hono } from "hono";
import { describeResponse, describeRoute } from "hono-openapi";
import * as z from "zod";

export const signUpResponseSchema = z
  .object({
    signUp: z.enum(["open", "closed"]),
  })
  .meta({ id: "SignUpStatus" });

export interface SignUpRoutesOptions {
  signUpEnabled: boolean;
}

export function createSignUpRoutes({
  signUpEnabled,
}: Readonly<SignUpRoutesOptions>) {
  const response = {
    signUp: signUpEnabled ? "open" : "closed",
  } as const;

  return new Hono().get(
    "/sign-up",
    describeRoute({
      operationId: "getSignUpStatus",
      summary: "Check Sign-up availability",
      tags: ["Authentication"],
    }),
    describeResponse((c) => c.json(response, 200), {
      200: {
        description: "Sign-up availability",
        content: { "application/json": { vSchema: signUpResponseSchema } },
      },
    }),
  );
}
