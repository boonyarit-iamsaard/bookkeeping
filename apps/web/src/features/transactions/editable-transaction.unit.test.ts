import { describe, expect, test } from "vitest";
import type { components } from "@/core/api/openapi.gen";
import {
  editableTransaction,
  expenseRefundLimits,
} from "@/features/transactions/editable-transaction";

const wallet: components["schemas"]["TransactionWallet"] = {
  id: "wallet-1",
  name: "Cash",
  type: "cash",
  archived: false,
};

const expense: components["schemas"]["Transaction"] = {
  id: "expense-1",
  type: "expense",
  amount: { value: "500.00", currency: "THB" },
  transactionDate: "2026-09-02",
  note: "Kettle",
  recordedAt: "2026-09-02T05:04:00Z",
  wallet,
  destinationWallet: null,
  category: {
    id: "category-1",
    name: "Groceries",
    iconId: "shopping-cart",
    parentName: "Food & Drink",
  },
  refundOf: null,
};

const refunds: components["schemas"]["TransactionRefunds"] = {
  refunds: [
    {
      id: "refund-1",
      amount: { value: "100.00", currency: "THB" },
      transactionDate: "2026-09-03",
      wallet,
    },
    {
      id: "refund-2",
      amount: { value: "50.00", currency: "THB" },
      transactionDate: "2026-09-05",
      wallet,
    },
  ],
  refundedTotal: { value: "150.00", currency: "THB" },
  remaining: { value: "350.00", currency: "THB" },
};

describe("expenseRefundLimits", () => {
  test("names the refunded total and the earliest refund's date", () => {
    expect(expenseRefundLimits(refunds)).toEqual({
      refundedTotal: 15_000n,
      earliestRefundDate: "2026-09-03",
    });
  });

  test("is absent without refunds", () => {
    expect(
      expenseRefundLimits({
        refunds: [],
        refundedTotal: { value: "0.00", currency: "THB" },
        remaining: { value: "500.00", currency: "THB" },
      }),
    ).toBeUndefined();
  });
});

describe("editableTransaction", () => {
  test("loads an expense with its category, amount text, and refund footer", () => {
    expect(editableTransaction({ transaction: expense, refunds })).toEqual({
      id: "expense-1",
      type: "expense",
      walletId: "wallet-1",
      categoryId: "category-1",
      destinationWalletId: "",
      amountText: "500.00",
      transactionDate: "2026-09-02",
      note: "Kettle",
      recordedLabel: "2 Sep 2026, 12:04",
      refundOf: undefined,
      refundedLabel: "฿150.00",
      expenseRefunds: {
        refundedTotal: 15_000n,
        earliestRefundDate: "2026-09-03",
      },
    });
  });

  test("leaves a refund's category empty and carries its expense", () => {
    const refundOf = {
      id: "expense-1",
      amountLabel: "฿500.00",
      transactionDate: "2026-09-02",
      categoryLabel: "Food & Drink › Groceries",
      categoryIconId: "shopping-cart",
      wallet: { id: "wallet-1", name: "Cash", archived: false },
      remainingText: "450.00",
      remainingLabel: "฿450.00",
    };
    const editable = editableTransaction({
      transaction: {
        ...expense,
        id: "refund-1",
        type: "refund",
        amount: { value: "100.00", currency: "THB" },
        refundOf: {
          id: "expense-1",
          amount: { value: "500.00", currency: "THB" },
          transactionDate: "2026-09-02",
        },
      },
      refundOf,
    });
    expect(editable.categoryId).toBe("");
    expect(editable.refundOf).toBe(refundOf);
    expect(editable.refundedLabel).toBeUndefined();
    expect(editable.expenseRefunds).toBeUndefined();
  });
});
