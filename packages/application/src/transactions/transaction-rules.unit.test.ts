import type { RefundSummary } from "@bookkeeping/domain/transactions";
import { describe, expect, test } from "vitest";
import type { TransactionCommand, TransactionFacts } from "./transaction-rules";
import {
  acceptTransaction,
  sameSnapshot,
  snapshotOf,
} from "./transaction-rules";

const CASH = "0192f7a0-0000-7000-8000-000000000001";
const BANK = "0192f7a0-0000-7000-8000-000000000002";
const GROCERIES = "0192f7a0-0000-7000-8000-000000000010";
const EXPENSE = "0192f7a0-0000-7000-8000-000000000100";
const REFUND = "0192f7a0-0000-7000-8000-000000000101";

const wallet = {
  id: CASH,
  name: "Cash",
  type: "cash",
  archived: false,
} as const;

function refund(amount: bigint, transactionDate = "2026-09-05"): RefundSummary {
  return { id: REFUND, amount, transactionDate, wallet };
}

const facts: TransactionFacts = {
  today: "2026-09-10",
  wallets: [
    { id: CASH, openingDate: "2026-09-01", archivedAt: null },
    { id: BANK, openingDate: "2026-09-03", archivedAt: null },
  ],
  category: { id: GROCERIES, kind: "expense" },
  expense: null,
  current: null,
};

const expense: TransactionCommand = {
  type: "expense",
  walletId: CASH,
  categoryId: GROCERIES,
  destinationWalletId: null,
  refundOfTransactionId: null,
  amount: 50_000n,
  transactionDate: "2026-09-05",
  note: "Weekly shop",
};

const transfer: TransactionCommand = {
  ...expense,
  type: "transfer",
  categoryId: null,
  destinationWalletId: BANK,
};

const refundCommand: TransactionCommand = {
  ...expense,
  type: "refund",
  categoryId: null,
  refundOfTransactionId: EXPENSE,
  amount: 10_000n,
  transactionDate: "2026-09-06",
};

const refundFacts: TransactionFacts = {
  ...facts,
  category: null,
  expense: {
    id: EXPENSE,
    amount: 50_000n,
    transactionDate: "2026-09-04",
    refunds: [refund(30_000n)],
  },
};

function rejection(command: TransactionCommand, given: TransactionFacts) {
  const result = acceptTransaction(command, given);
  return result.ok ? undefined : result.error;
}

describe("acceptTransaction", () => {
  test("accepts an expense and returns the command it judged", () => {
    expect(acceptTransaction(expense, facts)).toEqual({
      ok: true,
      value: expense,
    });
  });

  test("bounds the amount, note, and calendar date before anything else", () => {
    expect(rejection({ ...expense, amount: 0n }, facts)).toEqual({
      field: "amount",
      code: "amount-out-of-range",
    });
    expect(rejection({ ...expense, amount: 10_000_000_000n }, facts)).toEqual({
      field: "amount",
      code: "amount-out-of-range",
    });
    expect(rejection({ ...expense, note: "x".repeat(201) }, facts)).toEqual({
      field: "note",
      code: "note-too-long",
    });
    expect(
      rejection({ ...expense, transactionDate: "2026-02-30" }, facts),
    ).toEqual({ field: "transactionDate", code: "invalid-date" });
  });

  test("a transfer names two distinct wallets and no category", () => {
    expect(rejection({ ...expense, destinationWalletId: BANK }, facts)).toEqual(
      { field: "type", code: "invalid-transfer" },
    );
    expect(
      rejection({ ...transfer, destinationWalletId: null }, facts),
    ).toEqual({ field: "type", code: "invalid-transfer" });
    expect(rejection({ ...transfer, categoryId: GROCERIES }, facts)).toEqual({
      field: "type",
      code: "invalid-transfer",
    });
    expect(
      rejection({ ...transfer, destinationWalletId: CASH }, facts),
    ).toEqual({ field: "destinationWalletId", code: "same-wallet" });
    expect(acceptTransaction(transfer, facts).ok).toBe(true);
  });

  test("a refund names its expense and no category; nothing else names one", () => {
    expect(
      rejection({ ...expense, refundOfTransactionId: EXPENSE }, facts),
    ).toEqual({ field: "type", code: "invalid-refund" });
    expect(
      rejection({ ...refundCommand, refundOfTransactionId: null }, refundFacts),
    ).toEqual({ field: "type", code: "invalid-refund" });
    expect(
      rejection({ ...refundCommand, categoryId: GROCERIES }, refundFacts),
    ).toEqual({ field: "type", code: "invalid-refund" });
    expect(rejection(refundCommand, { ...refundFacts, expense: null })).toEqual(
      {
        field: "refundOfTransactionId",
        code: "expense-not-found",
      },
    );
  });

  test("every named wallet must be among the owner's, and active unless retained", () => {
    expect(rejection(expense, { ...facts, wallets: [] })).toEqual({
      field: "walletId",
      code: "wallet-not-found",
    });
    expect(
      rejection(transfer, { ...facts, wallets: facts.wallets.slice(0, 1) }),
    ).toEqual({
      field: "destinationWalletId",
      code: "destination-wallet-not-found",
    });
    const archivedBank: TransactionFacts = {
      ...facts,
      wallets: [
        facts.wallets[0],
        { id: BANK, openingDate: "2026-09-03", archivedAt: new Date() },
      ],
    };
    expect(rejection(transfer, archivedBank)).toEqual({
      field: "destinationWalletId",
      code: "wallet-archived",
      walletId: BANK,
    });
    expect(rejection({ ...expense, walletId: BANK }, archivedBank)).toEqual({
      field: "walletId",
      code: "wallet-archived",
      walletId: BANK,
    });
    expect(
      rejection(
        { ...expense, walletId: BANK },
        {
          ...archivedBank,
          current: { id: EXPENSE, walletIds: [BANK], refunds: [] },
        },
      ),
    ).toBeUndefined();
  });

  test("income and expenses need an owned category of their own kind", () => {
    expect(rejection(expense, { ...facts, category: null })).toEqual({
      field: "categoryId",
      code: "category-not-found",
    });
    expect(rejection({ ...expense, categoryId: null }, facts)).toEqual({
      field: "categoryId",
      code: "category-not-found",
    });
    expect(
      rejection(expense, {
        ...facts,
        category: { id: GROCERIES, kind: "income" },
      }),
    ).toEqual({ field: "categoryId", code: "category-kind-mismatch" });
  });

  test("the date is neither in the future nor before any named wallet opened", () => {
    expect(
      rejection({ ...expense, transactionDate: "2026-09-11" }, facts),
    ).toEqual({
      field: "transactionDate",
      code: "future-date",
      today: "2026-09-10",
    });
    expect(
      rejection({ ...transfer, transactionDate: "2026-09-02" }, facts),
    ).toEqual({
      field: "transactionDate",
      code: "before-opening",
      openingDate: "2026-09-03",
    });
  });

  test("a refund stays within its expense's date and refund allowance", () => {
    expect(acceptTransaction(refundCommand, refundFacts).ok).toBe(true);
    expect(
      rejection(
        { ...refundCommand, transactionDate: "2026-09-03" },
        refundFacts,
      ),
    ).toEqual({
      field: "transactionDate",
      code: "before-expense",
      expenseDate: "2026-09-04",
    });
    expect(
      rejection({ ...refundCommand, amount: 20_001n }, refundFacts),
    ).toEqual({
      field: "amount",
      code: "exceeds-refundable",
      remaining: 20_000n,
    });
  });

  test("a refund under correction does not count its own old amount", () => {
    const editing: TransactionFacts = {
      ...refundFacts,
      current: { id: REFUND, walletIds: [CASH], refunds: [] },
    };
    expect(
      rejection({ ...refundCommand, amount: 50_000n }, editing),
    ).toBeUndefined();
    expect(rejection({ ...refundCommand, amount: 50_001n }, editing)).toEqual({
      field: "amount",
      code: "exceeds-refundable",
      remaining: 50_000n,
    });
  });

  test("an expense under correction still covers and predates its refunds", () => {
    const editing: TransactionFacts = {
      ...facts,
      current: {
        id: EXPENSE,
        walletIds: [CASH],
        refunds: [refund(15_000n, "2026-09-06"), refund(5_000n, "2026-09-07")],
      },
    };
    expect(rejection(expense, editing)).toBeUndefined();
    expect(rejection({ ...expense, amount: 19_999n }, editing)).toEqual({
      field: "amount",
      code: "below-refunded",
      refundedTotal: 20_000n,
    });
    expect(
      rejection({ ...expense, transactionDate: "2026-09-07" }, editing),
    ).toEqual({
      field: "transactionDate",
      code: "after-refund",
      refundDate: "2026-09-06",
    });
  });
});

describe("snapshots", () => {
  test("a snapshot keeps the link that matches its type and compares every field", () => {
    const before = snapshotOf({ ...refundCommand, amount: 10_000n });
    expect(before).toEqual({
      type: "refund",
      walletId: CASH,
      categoryId: null,
      refundOfTransactionId: EXPENSE,
      amount: "10000",
      transactionDate: "2026-09-06",
      note: "Weekly shop",
    });
    expect(sameSnapshot(before, snapshotOf(refundCommand))).toBe(true);
    expect(
      sameSnapshot(
        before,
        snapshotOf({ ...refundCommand, refundOfTransactionId: REFUND }),
      ),
    ).toBe(false);
    expect(snapshotOf(transfer)).not.toHaveProperty("refundOfTransactionId");
    expect(snapshotOf(expense)).not.toHaveProperty("destinationWalletId");
  });
});
