import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import {
  categoryQueries,
  reportQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { sessionQuery } from "@/core/auth/session";
import { forgetReads, refreshAfterWrite } from "./refresh-after-write";

const SESSION_KEY = JSON.stringify(sessionQuery().queryKey);

const READ_KEYS: readonly (readonly unknown[])[] = [
  transactionQueries.list().queryKey,
  transactionQueries.detail("tx-1").queryKey,
  transactionQueries.refunds("tx-1").queryKey,
  transactionQueries.detail("tx-2").queryKey,
  walletQueries.list().queryKey,
  walletQueries.list({ asOf: "2026-09-01" }).queryKey,
  walletQueries.detail("wallet-1").queryKey,
  reportQueries.monthly("2026-09").queryKey,
  categoryQueries.list().queryKey,
  categoryQueries.usage().queryKey,
];

function seededClient() {
  const queryClient = new QueryClient({
    // Fresh until invalidated, so staleness shows what the refresh touched.
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  // Only the keys matter here; the seeded data is never read back.
  queryClient.setQueryData(sessionQuery().queryKey, null);
  for (const queryKey of READ_KEYS) {
    queryClient.setQueryData(queryKey, {});
  }
  return queryClient;
}

function staleKeys(queryClient: QueryClient): string[] {
  return queryClient
    .getQueryCache()
    .getAll()
    .filter((query) => query.isStale())
    .map((query) => JSON.stringify(query.queryKey))
    .sort();
}

describe("refreshAfterWrite", () => {
  test("marks every cached read stale except the session", async () => {
    const queryClient = seededClient();
    await refreshAfterWrite(queryClient);
    const stale = staleKeys(queryClient);
    expect(stale).toEqual(
      READ_KEYS.map((queryKey) => JSON.stringify(queryKey)).sort(),
    );
    expect(stale).not.toContain(SESSION_KEY);
  });

  test("leaves a deleted record's retired reads alone", async () => {
    const queryClient = seededClient();
    await refreshAfterWrite(queryClient, {
      retired: [
        transactionQueries.detail("tx-1").queryKey,
        transactionQueries.refunds("tx-1").queryKey,
      ],
    });
    const stale = staleKeys(queryClient);
    expect(stale).not.toContain(
      JSON.stringify(transactionQueries.detail("tx-1").queryKey),
    );
    expect(stale).not.toContain(
      JSON.stringify(transactionQueries.refunds("tx-1").queryKey),
    );
    expect(stale).toContain(
      JSON.stringify(transactionQueries.detail("tx-2").queryKey),
    );
  });
});

describe("forgetReads", () => {
  test("drops only the retired reads", () => {
    const queryClient = seededClient();
    forgetReads(queryClient, [walletQueries.detail("wallet-1").queryKey]);
    const remaining = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => JSON.stringify(query.queryKey))
      .sort();
    expect(remaining).toEqual(
      [...READ_KEYS, sessionQuery().queryKey]
        .filter((queryKey) => queryKey[0] !== "/v1/wallets/{walletId}")
        .map((queryKey) => JSON.stringify(queryKey))
        .sort(),
    );
  });
});
