import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createTransactionFormSchema,
  createTransactionSubmissionSchema,
} from "@/features/transactions/transaction-form-schema";

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
    ["0", "must be at least ฿0.01"],
    ["-5", "must be at least ฿0.01"],
    ["1.005", "at most two decimals"],
    ["100000000", "at most ฿99,999,999.99"],
  ])("rejects amount %j", (amount, message) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
    const result = createTransactionFormSchema().safeParse({ ...base, amount });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.map((issue) => issue.message).join("\n"),
    ).toContain(message);
  });

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
    const future = schema.safeParse({ ...base, transactionDate: "2026-09-15" });
    expect(future.error?.issues[0]?.message).toContain("future");
    const early = schema.safeParse({ ...base, transactionDate: "2026-08-31" });
    expect(early.error?.issues[0]?.message).toContain("1 Sep 2026");
  });

  test("the submission schema additionally requires the key", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
    const schema = createTransactionSubmissionSchema();
    expect(schema.safeParse(base).success).toBe(false);
    expect(schema.safeParse({ ...base, submissionKey: "key-1" }).success).toBe(
      true,
    );
  });

  test("rejects a note over 200 characters", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
    const schema = createTransactionFormSchema();
    expect(schema.safeParse({ ...base, note: "x".repeat(200) }).success).toBe(
      true,
    );
    expect(schema.safeParse({ ...base, note: "x".repeat(201) }).success).toBe(
      false,
    );
  });
});

test("transfer submissions require explicit THB and a distinct destination, with no category selection", () => {
  const schema = createTransactionSubmissionSchema();
  const input = {
    ...base,
    type: "transfer",
    destinationWalletId: "wallet-2",
    categoryId: "",
    submissionKey: "transfer-key",
  };
  expect(schema.safeParse(input).success).toBe(true);
  for (const currency of [undefined, "USD", ""]) {
    expect(schema.safeParse({ ...input, currency }).success).toBe(false);
  }
  for (const destinationWalletId of ["", "wallet-1"]) {
    const invalid = schema.safeParse({ ...input, destinationWalletId });
    expect(invalid.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["destinationWalletId"] }),
      ]),
    );
  }
});

describe("linked refund form schema", () => {
  const refund = {
    ...base,
    type: "refund",
    categoryId: "",
    refundOfTransactionId: "expense-1",
  };
  const schema = createTransactionFormSchema({
    linkedExpense: { transactionDate: "2026-09-10", remaining: 30_000n },
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
    [{ amount: "300.01" }, ["amount", "Only ฿300.00 of this expense is left"]],
    [
      { transactionDate: "2026-09-09" },
      ["transactionDate", "dated 10 Sep 2026"],
    ],
    [
      { refundOfTransactionId: "" },
      ["refundOfTransactionId", "from its expense"],
    ],
  ])("rejects %j", (changes, [path, message]) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
    const result = schema.safeParse({ ...refund, ...changes });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.map((issue) => [issue.path[0], issue.message]),
    ).toEqual([[path, expect.stringContaining(message)]]);
  });

  test("names a fully refunded expense", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
    const full = createTransactionFormSchema({
      linkedExpense: { transactionDate: "2026-09-10", remaining: 0n },
    });
    expect(
      full.safeParse({ ...refund, amount: "0.01" }).error?.issues[0]?.message,
    ).toBe("This expense is already fully refunded");
  });
});
