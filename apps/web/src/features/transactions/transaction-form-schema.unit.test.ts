import { describe, expect, test } from "vitest";
import type * as z from "zod";
import { createTransactionFormSchema } from "@/features/transactions/transaction-form-schema";

/** The server rule, by code and facts, each mirrored hint asked for and where it shows. */
function rejectionsAsked(result: z.ZodSafeParseResult<unknown>) {
  return (result.error?.issues ?? []).flatMap((issue) =>
    issue.code === "custom" && issue.params?.rejection
      ? [{ path: issue.path.join("."), rejection: issue.params.rejection }]
      : [],
  );
}

const base = {
  type: "expense",
  currency: "THB",
  destinationWalletId: "",
  refundOfTransactionId: "",
  walletId: "wallet-1",
  categoryId: "category-1",
  amount: "120",
  transactionDate: "2026-09-13",
  note: "",
  tagIds: [],
};

describe("transaction form schema", () => {
  test("parses the typed amount into satang and keeps the rest", () => {
    const schema = createTransactionFormSchema({ today: "2026-09-13" });
    expect(schema.parse({ ...base, amount: "1,234.5" })).toEqual({
      ...base,
      amount: 123_450n,
    });
  });

  test.each([
    ["", "Enter an amount"],
    ["abc", "Enter an amount in baht"],
    ["1.005", "at most two decimals"],
  ])(
    "keeps its own wording for the unreadable amount %j",
    (amount, message) => {
      const result = createTransactionFormSchema({
        today: "2026-09-13",
      }).safeParse({
        ...base,
        amount,
      });
      expect(result.success).toBe(false);
      expect(
        result.error?.issues.map((issue) => issue.message).join("\n"),
      ).toContain(message);
      expect(rejectionsAsked(result)).toEqual([]);
    },
  );

  test.each(["0", "-5", "100000000", "1000000000000000"])(
    "asks for amount-out-of-range on amount %j",
    (amount) => {
      const result = createTransactionFormSchema({
        today: "2026-09-13",
      }).safeParse({
        ...base,
        amount,
      });
      expect(rejectionsAsked(result)).toEqual([
        { path: "amount", rejection: { code: "amount-out-of-range" } },
      ]);
    },
  );

  test("accepts the exact bounds", () => {
    const schema = createTransactionFormSchema({ today: "2026-09-13" });
    expect(schema.parse({ ...base, amount: "0.01" }).amount).toBe(1n);
    expect(schema.parse({ ...base, amount: "99,999,999.99" }).amount).toBe(
      9_999_999_999n,
    );
  });

  test("rejects dates after the supplied today and before the chosen wallet's opening", () => {
    const schema = createTransactionFormSchema({
      today: "2026-09-14",
      walletOpeningDates: { "wallet-1": "2026-09-01" },
    });
    expect(
      schema.safeParse({ ...base, transactionDate: "2026-09-14" }).success,
    ).toBe(true);
    expect(
      rejectionsAsked(
        schema.safeParse({ ...base, transactionDate: "2026-09-15" }),
      ),
    ).toEqual([
      { path: "transactionDate", rejection: { code: "future-date" } },
    ]);
    expect(
      rejectionsAsked(
        schema.safeParse({ ...base, transactionDate: "2026-08-31" }),
      ),
    ).toEqual([
      {
        path: "transactionDate",
        rejection: { code: "before-opening", openingDate: "2026-09-01" },
      },
    ]);
  });

  test("rejects a note over 200 characters", () => {
    const schema = createTransactionFormSchema({ today: "2026-09-13" });
    expect(schema.safeParse({ ...base, note: "x".repeat(200) }).success).toBe(
      true,
    );
    expect(
      rejectionsAsked(schema.safeParse({ ...base, note: "x".repeat(201) })),
    ).toEqual([{ path: "note", rejection: { code: "note-too-long" } }]);
  });
});

test("transfers require explicit THB and a distinct destination, with no category selection", () => {
  const schema = createTransactionFormSchema({ today: "2026-09-13" });
  const input = {
    ...base,
    type: "transfer",
    destinationWalletId: "wallet-2",
    categoryId: "",
  };
  expect(schema.safeParse(input).success).toBe(true);
  for (const currency of [undefined, "USD", ""]) {
    expect(schema.safeParse({ ...input, currency }).success).toBe(false);
  }
  expect(
    rejectionsAsked(
      schema.safeParse({ ...input, destinationWalletId: "wallet-1" }),
    ),
  ).toEqual([
    { path: "destinationWalletId", rejection: { code: "same-wallet" } },
  ]);
  // A destination left empty is a required-field hint, kept local: it asks no
  // server rule, so it is not the mirrored `same-wallet` message.
  const empty = schema.safeParse({ ...input, destinationWalletId: "" });
  expect(empty.error?.issues.map((issue) => issue.path)).toEqual([
    ["destinationWalletId"],
  ]);
  expect(rejectionsAsked(empty)).toEqual([]);
  expect(empty.error?.issues.map((issue) => issue.message)).toEqual([
    "Choose a destination wallet",
  ]);
});

describe("linked refund form schema", () => {
  const refund = {
    ...base,
    type: "refund",
    categoryId: "",
    refundOfTransactionId: "expense-1",
  };
  const schema = createTransactionFormSchema({
    today: "2026-09-13",
    linkedExpense: { transactionDate: "2026-09-10", refundAllowance: 30_000n },
  });

  test("accepts a refund up to what is left, dated on or after the expense", () => {
    expect(
      schema.safeParse({
        ...refund,
        amount: "300",
        transactionDate: "2026-09-10",
      }).success,
    ).toBe(true);
  });

  test.each([
    [
      { amount: "300.01" },
      {
        path: "amount",
        rejection: { code: "exceeds-refundable", refundAllowance: 30_000n },
      },
    ],
    [
      { transactionDate: "2026-09-09" },
      {
        path: "transactionDate",
        rejection: { code: "before-expense", expenseDate: "2026-09-10" },
      },
    ],
  ])("asks for the code and facts of %j", (changes, expected) => {
    expect(
      rejectionsAsked(schema.safeParse({ ...refund, ...changes })),
    ).toEqual([expected]);
  });

  test("a refund left without its expense keeps its own wording", () => {
    const result = schema.safeParse({ ...refund, refundOfTransactionId: "" });
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["refundOfTransactionId"],
    ]);
    expect(rejectionsAsked(result)).toEqual([]);
  });
});
