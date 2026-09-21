import { describe, expect, test } from "vitest";
import type { components } from "@/core/api/openapi.gen";
import { linkedExpenseView } from "@/features/transactions/linked-expense";

const expense: components["schemas"]["Transaction"] = {
  id: "expense-1",
  type: "expense",
  amount: { value: "500.00", currency: "THB" },
  transactionDate: "2026-09-02",
  note: "",
  recordedAt: "2026-09-02T05:00:00Z",
  wallet: { id: "wallet-1", name: "Cash", type: "cash", archived: false },
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
      wallet: { id: "wallet-1", name: "Cash", type: "cash", archived: false },
    },
  ],
  refundedTotal: { value: "100.00", currency: "THB" },
  remaining: { value: "400.00", currency: "THB" },
};

describe("linkedExpenseView", () => {
  test("shows the API allowance for a new refund", () => {
    expect(linkedExpenseView({ expense, refunds })).toEqual({
      id: "expense-1",
      amountLabel: "฿500.00",
      transactionDate: "2026-09-02",
      categoryLabel: "Food & Drink › Groceries",
      categoryIconId: "shopping-cart",
      wallet: { id: "wallet-1", name: "Cash", archived: false },
      remainingText: "400.00",
      remainingLabel: "฿400.00",
    });
  });

  test("adds the refund being edited back to the allowance", () => {
    const view = linkedExpenseView({
      expense,
      refunds,
      editingRefund: { amount: { value: "100.00", currency: "THB" } },
    });
    expect(view.remainingText).toBe("500.00");
    expect(view.remainingLabel).toBe("฿500.00");
  });
});
