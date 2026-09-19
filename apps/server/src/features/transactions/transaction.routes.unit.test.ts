import { describe, expect, test } from "vitest";
import type * as z from "zod";
import { createTransactionRequestSchema } from "./transaction.routes.js";

type TransactionCreationBody = z.input<typeof createTransactionRequestSchema>;

const validTransferSchemaBody = {
  type: "transfer",
  amount: { value: "123.45", currency: "THB" },
  walletId: "01999999-0000-7000-8000-000000000001",
  destinationWalletId: "01999999-0000-7000-8000-000000000002",
  transactionDate: "2026-09-02",
  note: "Move money",
} satisfies Extract<TransactionCreationBody, { type: "transfer" }>;

const validIncomeSchemaBody = {
  type: "income",
  amount: { value: "123.45", currency: "THB" },
  walletId: "01999999-0000-7000-8000-000000000001",
  categoryId: "01999999-0000-7000-8000-000000000003",
  transactionDate: "2026-09-02",
  note: "Salary",
} satisfies TransactionCreationBody;

describe("createTransactionRequestSchema", () => {
  test("accepts transfer and income shapes", () => {
    expect(
      createTransactionRequestSchema.safeParse(validTransferSchemaBody).success,
    ).toBe(true);
    expect(
      createTransactionRequestSchema.safeParse(validIncomeSchemaBody).success,
    ).toBe(true);
  });

  test("rejects transfer category, refund, and missing destination fields", () => {
    expect(
      createTransactionRequestSchema.safeParse({
        ...validTransferSchemaBody,
        destinationWalletId: undefined,
      }).success,
    ).toBe(false);
    expect(
      createTransactionRequestSchema.safeParse({
        ...validTransferSchemaBody,
        categoryId: "01999999-0000-7000-8000-000000000003",
      }).success,
    ).toBe(false);
    expect(
      createTransactionRequestSchema.safeParse({
        ...validTransferSchemaBody,
        refundOfTransactionId: "01999999-0000-7000-8000-000000000004",
      }).success,
    ).toBe(false);
  });
});
