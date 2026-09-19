import { describe, expect, test } from "vitest";
import type * as z from "zod";
import {
  createTransactionRequestSchema,
  updateTransactionRequestSchema,
} from "./transaction.routes.js";

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

const validRefundSchemaBody = {
  type: "refund",
  amount: { value: "123.45", currency: "THB" },
  walletId: "01999999-0000-7000-8000-000000000001",
  refundOfTransactionId: "01999999-0000-7000-8000-000000000004",
  transactionDate: "2026-09-02",
  note: "Returned",
} satisfies Extract<TransactionCreationBody, { type: "refund" }>;

describe("createTransactionRequestSchema", () => {
  test("accepts transfer, income, and refund shapes", () => {
    expect(
      createTransactionRequestSchema.safeParse(validTransferSchemaBody).success,
    ).toBe(true);
    expect(
      createTransactionRequestSchema.safeParse(validIncomeSchemaBody).success,
    ).toBe(true);
    expect(
      createTransactionRequestSchema.safeParse(validRefundSchemaBody).success,
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

  test("rejects refund category, missing link, and income or expense link fields", () => {
    expect(
      createTransactionRequestSchema.safeParse({
        ...validRefundSchemaBody,
        refundOfTransactionId: undefined,
      }).success,
    ).toBe(false);
    expect(
      createTransactionRequestSchema.safeParse({
        ...validRefundSchemaBody,
        categoryId: "01999999-0000-7000-8000-000000000003",
      }).success,
    ).toBe(false);
    expect(
      createTransactionRequestSchema.safeParse({
        ...validIncomeSchemaBody,
        refundOfTransactionId: "01999999-0000-7000-8000-000000000004",
      }).success,
    ).toBe(false);
  });
});

type TransactionUpdateBody = z.input<typeof updateTransactionRequestSchema>;

const validUpdateSchemaBody = {
  amount: { value: "123.45", currency: "THB" },
  walletId: "01999999-0000-7000-8000-000000000001",
  categoryId: "01999999-0000-7000-8000-000000000003",
  destinationWalletId: "01999999-0000-7000-8000-000000000002",
  transactionDate: "2026-09-02",
  note: "Corrected",
} satisfies TransactionUpdateBody;

describe("updateTransactionRequestSchema", () => {
  test("accepts the full body and bodies without the optional fields", () => {
    expect(
      updateTransactionRequestSchema.safeParse(validUpdateSchemaBody).success,
    ).toBe(true);
    const { categoryId, destinationWalletId, ...withoutOptionals } =
      validUpdateSchemaBody;
    expect(
      updateTransactionRequestSchema.safeParse(withoutOptionals).success,
    ).toBe(true);
  });

  test("rejects missing, malformed, and unknown fields", () => {
    expect(
      updateTransactionRequestSchema.safeParse({
        ...validUpdateSchemaBody,
        amount: undefined,
      }).success,
    ).toBe(false);
    expect(
      updateTransactionRequestSchema.safeParse({
        ...validUpdateSchemaBody,
        amount: { value: "123.45", currency: "USD" },
      }).success,
    ).toBe(false);
    expect(
      updateTransactionRequestSchema.safeParse({
        ...validUpdateSchemaBody,
        walletId: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      updateTransactionRequestSchema.safeParse({
        ...validUpdateSchemaBody,
        transactionDate: "2026-9-2",
      }).success,
    ).toBe(false);
    expect(
      updateTransactionRequestSchema.safeParse({
        ...validUpdateSchemaBody,
        type: "transfer",
      }).success,
    ).toBe(false);
    expect(
      updateTransactionRequestSchema.safeParse({
        ...validUpdateSchemaBody,
        refundOfTransactionId: "01999999-0000-7000-8000-000000000004",
      }).success,
    ).toBe(false);
  });
});
