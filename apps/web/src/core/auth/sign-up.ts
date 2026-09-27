import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import * as z from "zod";
import { apiClient } from "@/core/api/client";

const signUpStatusSchema = z.enum(["open", "closed"]);

export type SignUpStatus = z.infer<typeof signUpStatusSchema>;

const signUpResponseSchema = z.object({ signUp: signUpStatusSchema });

export function signUpQuery() {
  return queryOptions({
    queryKey: ["auth", "sign-up"] as const,
    queryFn: async ({ signal }): Promise<SignUpStatus> => {
      try {
        const result = await apiClient.GET("/sign-up", { signal });
        if (!result.response.ok || !("data" in result)) {
          return "closed";
        }

        const parsed = signUpResponseSchema.safeParse(result.data);
        return parsed.success ? parsed.data.signUp : "closed";
      } catch {
        return "closed";
      }
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}

export function readSignUp(queryClient: QueryClient): Promise<SignUpStatus> {
  return queryClient.ensureQueryData(signUpQuery());
}
