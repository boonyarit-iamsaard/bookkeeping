import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import {
  categoryQueries,
  reportQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import {
  forgetTransactionReads,
  invalidateTransactionReads,
} from "@/features/transactions/transaction-reads";

function seededClient() {
  const queryClient = new QueryClient();
  // Only the keys matter here; the seeded data is never read back.
  const seeds: readonly (readonly unknown[])[] = [
    transactionQueries.list().queryKey,
    transactionQueries.detail("tx-1").queryKey,
    transactionQueries.refunds("tx-1").queryKey,
    transactionQueries.detail("tx-2").queryKey,
    walletQueries.list().queryKey,
    walletQueries.detail("wallet-1").queryKey,
    reportQueries.monthly("2026-09").queryKey,
    categoryQueries.usage().queryKey,
    categoryQueries.list().queryKey,
  ];
  for (const queryKey of seeds) {
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

describe("invalidateTransactionReads", () => {
  test("marks history, detail, refunds, wallet, report, and usage reads stale", async () => {
    const queryClient = seededClient();
    await invalidateTransactionReads(queryClient);
    expect(staleKeys(queryClient)).toEqual(
      [
        transactionQueries.list().queryKey,
        transactionQueries.detail("tx-1").queryKey,
        transactionQueries.refunds("tx-1").queryKey,
        transactionQueries.detail("tx-2").queryKey,
        walletQueries.list().queryKey,
        walletQueries.detail("wallet-1").queryKey,
        reportQueries.monthly("2026-09").queryKey,
        categoryQueries.usage().queryKey,
      ]
        .map((queryKey) => JSON.stringify(queryKey))
        .sort(),
    );
  });

  test("leaves a deleted transaction's own reads alone", async () => {
    const queryClient = seededClient();
    await invalidateTransactionReads(queryClient, {
      deletedTransactionId: "tx-1",
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

describe("forgetTransactionReads", () => {
  test("drops only that transaction's detail and refunds reads", () => {
    const queryClient = seededClient();
    forgetTransactionReads(queryClient, "tx-1");
    const remaining = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => JSON.stringify(query.queryKey));
    expect(remaining).not.toContain(
      JSON.stringify(transactionQueries.detail("tx-1").queryKey),
    );
    expect(remaining).not.toContain(
      JSON.stringify(transactionQueries.refunds("tx-1").queryKey),
    );
    expect(remaining).toContain(
      JSON.stringify(transactionQueries.detail("tx-2").queryKey),
    );
    expect(remaining).toContain(
      JSON.stringify(transactionQueries.list().queryKey),
    );
  });
});
