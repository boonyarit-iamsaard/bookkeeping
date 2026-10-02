import { describe, expect, test } from "vitest";
import type { components } from "@/core/api/openapi.gen";
import { groupHistoryByMonth } from "@/features/transactions/history-groups";

function transactionOn(id: string, transactionDate: string) {
  const transaction: components["schemas"]["Transaction"] = {
    id,
    type: "income",
    amount: { value: "10.00", currency: "THB" },
    transactionDate,
    note: "",
    recordedAt: "2026-09-02T05:00:00Z",
    wallet: { id: "wallet-1", name: "Cash", type: "cash", archived: false },
    destinationWallet: null,
    category: null,
    refundOf: null,
  };
  return transaction;
}

describe("groupHistoryByMonth", () => {
  test("splits rows into runs by month, keeping their order", () => {
    const groups = groupHistoryByMonth([
      transactionOn("a", "2026-10-01"),
      transactionOn("b", "2026-09-30"),
      transactionOn("c", "2026-09-02"),
      transactionOn("d", "2025-12-31"),
    ]);

    expect(
      groups.map((group) => [
        group.key,
        group.label,
        group.transactions.map((transaction) => transaction.id),
      ]),
    ).toEqual([
      ["2026-10", "October 2026", ["a"]],
      ["2026-09", "September 2026", ["b", "c"]],
      ["2025-12", "December 2025", ["d"]],
    ]);
  });

  test("returns no groups for no rows", () => {
    expect(groupHistoryByMonth([])).toEqual([]);
  });
});
