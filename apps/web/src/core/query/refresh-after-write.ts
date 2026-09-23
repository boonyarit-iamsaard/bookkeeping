import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { hashKey } from "@tanstack/react-query";
import { sessionQuery } from "@/core/auth/session";

interface RefreshAfterWriteOptions {
  /**
   * A deleted record's own reads: re-reading them while their page is still
   * open can only answer not found, so they are left out. `forgetReads`
   * drops them once that page is left.
   */
  retired?: readonly QueryKey[];
}

/**
 * Re-reads what a successful write can change. Reads embed each other's
 * records (a transaction carries its wallet and category, a balance sums
 * transactions), so every read except the session is refreshed rather than
 * tracing which ones a write reached. Only reads on screen refetch now; the
 * rest refetch when next shown.
 */
export function refreshAfterWrite(
  queryClient: QueryClient,
  { retired = [] }: Readonly<RefreshAfterWriteOptions> = {},
): Promise<void> {
  const excluded = new Set([
    hashKey(sessionQuery().queryKey),
    ...retired.map((queryKey) => hashKey(queryKey)),
  ]);
  return queryClient.invalidateQueries({
    predicate: (query) => !excluded.has(query.queryHash),
  });
}

/** Drops a deleted record's retired reads so a later visit reads not found. */
export function forgetReads(
  queryClient: QueryClient,
  retired: readonly QueryKey[],
): void {
  const forgotten = new Set(retired.map((queryKey) => hashKey(queryKey)));
  queryClient.removeQueries({
    predicate: (query) => forgotten.has(query.queryHash),
  });
}
