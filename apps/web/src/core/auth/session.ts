import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import type { Session } from "@/core/auth/client";
import { authClient } from "@/core/auth/client";

/**
 * The session as the API last reported it. The route guards read it, so it is
 * cached like every other read and only fetched when the cache is empty.
 */
export function sessionQuery() {
  return queryOptions({
    queryKey: ["auth", "session"] as const,
    queryFn: async (): Promise<Session | null> => {
      const { data, error } = await authClient.getSession();
      if (error) {
        throw new Error(error.message ?? error.statusText);
      }
      return data;
    },
    staleTime: Number.POSITIVE_INFINITY,
    // A guard answers at once; a read the API cannot serve is not retried.
    retry: false,
  });
}

/** The cached session, read from the API when the cache holds none. */
export function readSession(queryClient: QueryClient): Promise<Session | null> {
  return queryClient.ensureQueryData(sessionQuery());
}

/**
 * Every cached read belongs to one signed-in user, so a session change (sign
 * in, sign up, sign out, or a 401) drops them all, the session included; the
 * next guard reads it afresh.
 */
export function resetSessionCache(queryClient: QueryClient): void {
  queryClient.clear();
}
