import { afterEach, describe, expect, test, vi } from "vitest";
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
  afterEach(() => {
    vi.useRealTimers();
  });

  test("parses the typed amount into satang and keeps the rest", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
    const schema = createTransactionFormSchema();
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
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
      const result = createTransactionFormSchema().safeParse({
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
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
      const result = createTransactionFormSchema().safeParse({
        ...base,
        amount,
      });
      expect(rejectionsAsked(result)).toEqual([
        { path: "amount", rejection: { code: "amount-out-of-range" } },
      ]);
    },
  );

  test("accepts the exact bounds", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
    const schema = createTransactionFormSchema();
    expect(schema.parse({ ...base, amount: "0.01" }).amount).toBe(1n);
    expect(schema.parse({ ...base, amount: "99,999,999.99" }).amount).toBe(
      9_999_999_999n,
    );
  });

  test("rejects future dates by Bangkok midnight and dates before the chosen wallet's opening", () => {
    // 17:30 UTC is already 14 Sep in Bangkok.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T17:30:00Z"));
    const schema = createTransactionFormSchema({
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
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
    const schema = createTransactionFormSchema();
    expect(schema.safeParse({ ...base, note: "x".repeat(200) }).success).toBe(
      true,
    );
    expect(
      rejectionsAsked(schema.safeParse({ ...base, note: "x".repeat(201) })),
    ).toEqual([{ path: "note", rejection: { code: "note-too-long" } }]);
  });
});

test("transfers require explicit THB and a distinct destination, with no category selection", () => {
  const schema = createTransactionFormSchema();
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
  // A destination left empty is a shape error with no server rule of its own.
  const empty = schema.safeParse({ ...input, destinationWalletId: "" });
  expect(empty.error?.issues.map((issue) => issue.path)).toEqual([
    ["destinationWalletId"],
  ]);
  expect(rejectionsAsked(empty)).toEqual([]);
});

describe("linked refund form schema", () => {
  const refund = {
    ...base,
    type: "refund",
    categoryId: "",
    refundOfTransactionId: "expense-1",
  };
  const schema = createTransactionFormSchema({
    linkedExpense: { transactionDate: "2026-09-10", refundAllowance: 30_000n },
  });

  test("accepts a refund up to what is left, dated on or after the expense", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
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
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
    expect(
      rejectionsAsked(schema.safeParse({ ...refund, ...changes })),
    ).toEqual([expected]);
  });

  test("a refund left without its expense keeps its own wording", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
    const result = schema.safeParse({ ...refund, refundOfTransactionId: "" });
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["refundOfTransactionId"],
    ]);
    expect(rejectionsAsked(result)).toEqual([]);
  });
});
