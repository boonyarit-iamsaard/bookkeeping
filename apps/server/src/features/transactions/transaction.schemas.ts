import type {
  ExpenseRefunds,
  RefundSummary,
  TransactionDetail,
} from "@bookkeeping/domain/transactions";
import { TRANSACTION_TYPES } from "@bookkeeping/domain/transactions";
import { WALLET_TYPES } from "@bookkeeping/domain/wallets";
import * as z from "zod";
import { createCollectionResponseSchema } from "../../core/http/collection.js";
import {
  moneyInputSchema,
  moneySchema,
  presentMoney,
} from "../../core/http/money.js";
import type { ProblemOptions } from "../../core/http/problem-details.js";
import { problemDetailsSchema } from "../../core/http/problem-details.js";

export const transactionWalletSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    type: z.enum(WALLET_TYPES),
    archived: z.boolean(),
  })
  .meta({ id: "TransactionWallet" });

export const transactionTagSchema = z
  .object({ id: z.uuid(), name: z.string() })
  .meta({ id: "TransactionTag" });

const tagIdsInputSchema = z.array(z.uuid());

export const transactionResponseSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(TRANSACTION_TYPES),
    amount: moneySchema,
    transactionDate: z.iso.date(),
    note: z.string(),
    recordedAt: z.iso.datetime(),
    wallet: transactionWalletSchema,
    destinationWallet: transactionWalletSchema.nullable(),
    category: z
      .object({
        id: z.uuid(),
        name: z.string(),
        iconId: z.string(),
        parentName: z.string().nullable(),
      })
      .nullable(),
    refundOf: z
      .object({
        id: z.uuid(),
        amount: moneySchema,
        transactionDate: z.iso.date(),
      })
      .nullable(),
    tags: z.array(transactionTagSchema),
  })
  .meta({ id: "Transaction" });

export const transactionCollectionResponseSchema =
  createCollectionResponseSchema(transactionResponseSchema).meta({
    id: "TransactionCollection",
  });

/** A refund as it counts against its expense's refund allowance. */
export const transactionRefundSchema = z
  .object({
    id: z.uuid(),
    amount: moneySchema,
    transactionDate: z.iso.date(),
    wallet: transactionWalletSchema,
  })
  .meta({ id: "TransactionRefund" });

export const transactionRefundsResponseSchema = z
  .object({
    refunds: z.array(transactionRefundSchema),
    refundedTotal: moneySchema,
    refundAllowance: moneySchema,
  })
  .meta({ id: "TransactionRefunds" });

/** The 409 an expense answers while refunds still count against it: they are listed so a client can remove them first. */
export const refundsExistProblemSchema = problemDetailsSchema
  .extend({
    code: z.literal("refunds-exist"),
    refunds: z.array(transactionRefundSchema),
  })
  .meta({ id: "RefundsExistProblem" });

export const refundsExistProblem: ProblemOptions<409> = {
  code: "refunds-exist",
  status: 409,
  title: "Expense still has linked refunds",
};

export const transactionEntryDefaultsResponseSchema = z
  .object({ lastUsedWalletId: z.uuid().nullable() })
  .meta({ id: "TransactionEntryDefaults" });

const calendarDateInputSchema = z
  .string()
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
    error: "Use a calendar date in YYYY-MM-DD form",
    params: { code: "invalid-date" },
  });

const createIncomeExpenseTransactionRequestSchema = z.strictObject({
  type: z.enum(["income", "expense"]),
  amount: moneyInputSchema,
  walletId: z.uuid(),
  categoryId: z.uuid(),
  transactionDate: calendarDateInputSchema,
  note: z.string(),
  tagIds: tagIdsInputSchema.optional(),
});

const createTransferTransactionRequestSchema = z.strictObject({
  type: z.literal("transfer"),
  amount: moneyInputSchema,
  walletId: z.uuid(),
  destinationWalletId: z.uuid(),
  transactionDate: calendarDateInputSchema,
  note: z.string(),
});

const createRefundTransactionRequestSchema = z.strictObject({
  type: z.literal("refund"),
  amount: moneyInputSchema,
  walletId: z.uuid(),
  refundOfTransactionId: z.uuid(),
  transactionDate: calendarDateInputSchema,
  note: z.string(),
});

export const createTransactionRequestSchema = z
  .discriminatedUnion("type", [
    createIncomeExpenseTransactionRequestSchema,
    createTransferTransactionRequestSchema,
    createRefundTransactionRequestSchema,
  ])
  .meta({ id: "CreateTransactionRequest" });

export const updateTransactionRequestSchema = z
  .strictObject({
    amount: moneyInputSchema,
    walletId: z.uuid(),
    categoryId: z.uuid().optional(),
    destinationWalletId: z.uuid().optional(),
    transactionDate: calendarDateInputSchema,
    note: z.string(),
    tagIds: tagIdsInputSchema,
  })
  .meta({ id: "UpdateTransactionRequest" });

export type TransactionWalletResponse = z.infer<typeof transactionWalletSchema>;

export type TransactionResponse = z.infer<typeof transactionResponseSchema>;

export type TransactionRefundsResponse = z.infer<
  typeof transactionRefundsResponseSchema
>;

function presentTransactionWallet(
  wallet: Readonly<TransactionDetail["wallet"]>,
): TransactionWalletResponse {
  return {
    id: wallet.id,
    name: wallet.name,
    type: wallet.type,
    archived: wallet.archived,
  };
}

export function presentTransaction(
  transaction: Readonly<TransactionDetail>,
): TransactionResponse {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: presentMoney({
      amountInMinorUnits: transaction.amount,
      currency: transaction.currency,
    }),
    transactionDate: transaction.transactionDate,
    note: transaction.note,
    recordedAt: transaction.recordedAt.toISOString(),
    wallet: presentTransactionWallet(transaction.wallet),
    destinationWallet: transaction.destinationWallet
      ? presentTransactionWallet(transaction.destinationWallet)
      : null,
    category: transaction.category ? { ...transaction.category } : null,
    refundOf: transaction.refundOf
      ? {
          id: transaction.refundOf.id,
          amount: presentMoney({
            amountInMinorUnits: transaction.refundOf.amount,
            currency: transaction.currency,
          }),
          transactionDate: transaction.refundOf.transactionDate,
        }
      : null,
    tags: transaction.tags.map((tag) => ({ id: tag.id, name: tag.name })),
  };
}

export type TransactionRefundResponse = z.infer<typeof transactionRefundSchema>;

// The schema constrains every transaction to THB, so refunds and totals carry it.
export function presentTransactionRefund(
  refund: Readonly<RefundSummary>,
): TransactionRefundResponse {
  return {
    id: refund.id,
    amount: presentMoney({
      amountInMinorUnits: refund.amount,
      currency: "THB",
    }),
    transactionDate: refund.transactionDate,
    wallet: presentTransactionWallet(refund.wallet),
  };
}

export function presentTransactionRefunds(
  refunds: Readonly<ExpenseRefunds>,
): TransactionRefundsResponse {
  return {
    refunds: refunds.refunds.map(presentTransactionRefund),
    refundedTotal: presentMoney({
      amountInMinorUnits: refunds.refundedTotal,
      currency: "THB",
    }),
    refundAllowance: presentMoney({
      amountInMinorUnits: refunds.refundAllowance,
      currency: "THB",
    }),
  };
}
