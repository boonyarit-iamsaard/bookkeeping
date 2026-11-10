import { describe, expect, test } from "vitest";
import type {
  CategoryOption,
  EditableTransaction,
  LinkedExpenseView,
  WalletOption,
} from "@/features/transactions/transaction.types";
import type { TransactionEntry } from "@/features/transactions/transaction-entry";
import {
  entryRequest,
  openEntry,
  valuesForType,
} from "@/features/transactions/transaction-entry";
import type { TransactionFormValues } from "@/features/transactions/transaction-form-schema";

const categories: CategoryOption[] = [
  {
    id: "salary",
    kind: "income",
    parentId: null,
    name: "Salary",
    iconId: "banknote",
    isProtected: false,
  },
  {
    id: "income-uncategorized",
    kind: "income",
    parentId: null,
    name: "Uncategorized",
    iconId: "generic",
    isProtected: true,
  },
  {
    id: "groceries",
    kind: "expense",
    parentId: null,
    name: "Groceries",
    iconId: "shopping-cart",
    isProtected: false,
  },
  {
    id: "expense-uncategorized",
    kind: "expense",
    parentId: null,
    name: "Uncategorized",
    iconId: "generic",
    isProtected: true,
  },
];

const today = "2026-11-10";

const expense: LinkedExpenseView = {
  id: "expense-1",
  amountLabel: "฿500.00",
  transactionDate: "2026-09-02",
  categoryId: "groceries",
  categoryLabel: "Groceries",
  categoryIconId: "shopping-cart",
  tags: [{ id: "tag-1", name: "Coffee" }],
  wallet: { id: "cash", name: "Cash", archived: false },
  refundAllowance: 35_050n,
};

describe("openEntry", () => {
  test("records an Uncategorized expense today from the default wallet", () => {
    const entry = openEntry({
      mode: {
        kind: "record",
        defaultWalletId: "cash",
        captureOrigin: { pathname: "/wallets/cash", search: "" },
      },
      categories,
      today,
    });

    expect(entry).toEqual({
      initialValues: {
        type: "expense",
        currency: "THB",
        destinationWalletId: "",
        refundOfTransactionId: "",
        walletId: "cash",
        categoryId: "expense-uncategorized",
        amount: "",
        transactionDate: today,
        note: "",
        tagIds: [],
      },
      cancelHref: "/wallets/cash",
      captureOrigin: { pathname: "/wallets/cash", search: "" },
    });
  });

  test("records a Refund of the whole allowance today, fixed to its expense", () => {
    const entry = openEntry({
      mode: { kind: "refund", expense, defaultWalletId: "cash" },
      categories,
      today,
    });

    expect(entry).toEqual({
      initialValues: {
        type: "refund",
        currency: "THB",
        destinationWalletId: "",
        refundOfTransactionId: "expense-1",
        walletId: "cash",
        categoryId: "",
        amount: "350.50",
        transactionDate: today,
        note: "",
        tagIds: [],
      },
      limits: { transactionDate: "2026-09-02", refundAllowance: 35_050n },
      fixedType: "refund",
      linkedExpense: expense,
      cancelHref: "/transactions/expense-1",
    });
  });

  test("corrects an expense in place, keeping its type and values as saved", () => {
    const transaction: EditableTransaction = {
      id: "expense-1",
      type: "expense",
      walletId: "cash",
      categoryId: "groceries",
      destinationWalletId: "",
      amountText: "500.00",
      transactionDate: "2026-09-02",
      note: "Kettle",
      tagIds: ["tag-1"],
      recordedLabel: "2 Sep 2026, 12:04",
    };
    const entry = openEntry({
      mode: { kind: "correct", transaction },
      categories,
      today,
    });

    expect(entry).toEqual({
      initialValues: {
        type: "expense",
        currency: "THB",
        destinationWalletId: "",
        refundOfTransactionId: "",
        walletId: "cash",
        categoryId: "groceries",
        amount: "500.00",
        transactionDate: "2026-09-02",
        note: "Kettle",
        tagIds: ["tag-1"],
      },
      fixedType: "expense",
      cancelHref: "/transactions/expense-1",
      correcting: transaction,
    });
  });

  test("corrects a refund within what is left on its expense", () => {
    const transaction: EditableTransaction = {
      id: "refund-1",
      type: "refund",
      walletId: "cash",
      categoryId: "groceries",
      destinationWalletId: "",
      amountText: "100.00",
      transactionDate: "2026-09-03",
      note: "",
      tagIds: ["tag-1"],
      recordedLabel: "3 Sep 2026, 09:00",
      refundOf: expense,
    };
    const entry = openEntry({
      mode: { kind: "correct", transaction },
      categories,
      today,
    });

    expect(entry.initialValues).toMatchObject({
      type: "refund",
      refundOfTransactionId: "expense-1",
      amount: "100.00",
    });
    expect(entry.limits).toEqual({
      transactionDate: "2026-09-02",
      refundAllowance: 35_050n,
    });
    expect(entry.fixedType).toBe("refund");
    expect(entry.linkedExpense).toBe(expense);
    expect(entry.cancelHref).toBe("/transactions/refund-1");
  });
});

function values(
  overrides: Partial<TransactionFormValues> = {},
): TransactionFormValues {
  return {
    type: "expense",
    currency: "THB",
    destinationWalletId: "",
    refundOfTransactionId: "",
    walletId: "cash",
    categoryId: "groceries",
    amount: 12_050n,
    transactionDate: "2026-11-09",
    note: "Lunch",
    tagIds: [],
    ...overrides,
  };
}

const recording: TransactionEntry = {
  initialValues: { ...values(), amount: "" },
  cancelHref: "/",
};

function correcting(type: TransactionFormValues["type"]): TransactionEntry {
  return {
    ...recording,
    fixedType: type,
    correcting: {
      id: "saved-1",
      type,
      walletId: "cash",
      categoryId: "",
      destinationWalletId: "",
      amountText: "120.50",
      transactionDate: "2026-11-09",
      note: "",
      tagIds: [],
      recordedLabel: "9 Nov 2026, 12:00",
    },
  };
}

describe("entryRequest", () => {
  test("records an expense with its amount as a baht decimal and its tags", () => {
    expect(entryRequest(recording, values({ tagIds: ["tag-1"] }))).toEqual({
      kind: "create",
      request: {
        type: "expense",
        amount: { value: "120.50", currency: "THB" },
        walletId: "cash",
        categoryId: "groceries",
        transactionDate: "2026-11-09",
        note: "Lunch",
        tagIds: ["tag-1"],
      },
    });
  });

  test("records an untagged entry without a tag list", () => {
    const outcome = entryRequest(recording, values());
    expect(outcome.kind === "create" && outcome.request).not.toHaveProperty(
      "tagIds",
    );
  });

  test("records a refund without a category or tags of its own", () => {
    expect(
      entryRequest(
        recording,
        values({
          type: "refund",
          refundOfTransactionId: "expense-1",
          tagIds: ["tag-1"],
        }),
      ),
    ).toEqual({
      kind: "create",
      request: {
        type: "refund",
        amount: { value: "120.50", currency: "THB" },
        walletId: "cash",
        refundOfTransactionId: "expense-1",
        transactionDate: "2026-11-09",
        note: "Lunch",
      },
    });
  });

  test("records a transfer to its destination without a category", () => {
    expect(
      entryRequest(
        recording,
        values({ type: "transfer", destinationWalletId: "bank" }),
      ),
    ).toEqual({
      kind: "create",
      request: {
        type: "transfer",
        amount: { value: "120.50", currency: "THB" },
        walletId: "cash",
        destinationWalletId: "bank",
        transactionDate: "2026-11-09",
        note: "Lunch",
      },
    });
  });

  test("corrects an expense, naming every tag it keeps", () => {
    expect(
      entryRequest(correcting("expense"), values({ tagIds: ["tag-1"] })),
    ).toEqual({
      kind: "update",
      transactionId: "saved-1",
      request: {
        amount: { value: "120.50", currency: "THB" },
        walletId: "cash",
        categoryId: "groceries",
        transactionDate: "2026-11-09",
        note: "Lunch",
        tagIds: ["tag-1"],
      },
    });
  });

  test("corrects a transfer with an empty tag list and no category", () => {
    expect(
      entryRequest(
        correcting("transfer"),
        values({ type: "transfer", destinationWalletId: "bank" }),
      ),
    ).toEqual({
      kind: "update",
      transactionId: "saved-1",
      request: {
        amount: { value: "120.50", currency: "THB" },
        walletId: "cash",
        destinationWalletId: "bank",
        transactionDate: "2026-11-09",
        note: "Lunch",
        tagIds: [],
      },
    });
  });

  test("corrects a refund without sending back its expense's category or tags", () => {
    expect(
      entryRequest(
        correcting("refund"),
        values({
          type: "refund",
          refundOfTransactionId: "expense-1",
          tagIds: ["tag-1"],
        }),
      ),
    ).toEqual({
      kind: "update",
      transactionId: "saved-1",
      request: {
        amount: { value: "120.50", currency: "THB" },
        walletId: "cash",
        transactionDate: "2026-11-09",
        note: "Lunch",
        tagIds: [],
      },
    });
  });
});

const wallets: WalletOption[] = [
  {
    id: "cash",
    name: "Cash",
    type: "cash",
    openingDate: "2026-09-01",
    balanceLabel: "฿1,000.00",
  },
  {
    id: "bank",
    name: "Bank",
    type: "bank_account",
    openingDate: "2026-09-01",
    balanceLabel: "฿5,000.00",
  },
];

describe("valuesForType", () => {
  const expenseValues = {
    ...recording.initialValues,
    categoryId: "groceries",
    tagIds: ["tag-1"],
  };

  test("a transfer drops the category and tags and picks another wallet as destination", () => {
    expect(
      valuesForType({
        values: expenseValues,
        type: "transfer",
        wallets,
        categories,
      }),
    ).toEqual({
      type: "transfer",
      categoryId: "",
      tagIds: [],
      destinationWalletId: "bank",
    });
  });

  test("a transfer keeps a destination already chosen", () => {
    expect(
      valuesForType({
        values: { ...expenseValues, destinationWalletId: "cash" },
        type: "transfer",
        wallets,
        categories,
      }),
    ).toEqual({ type: "transfer", categoryId: "", tagIds: [] });
  });

  test("income swaps an expense category for its own Uncategorized and keeps the tags", () => {
    expect(
      valuesForType({
        values: expenseValues,
        type: "income",
        wallets,
        categories,
      }),
    ).toEqual({
      type: "income",
      categoryId: "income-uncategorized",
      destinationWalletId: "",
    });
  });

  test("an expense keeps a category of its own kind", () => {
    expect(
      valuesForType({
        values: expenseValues,
        type: "expense",
        wallets,
        categories,
      }),
    ).toEqual({ type: "expense", destinationWalletId: "" });
  });
});
