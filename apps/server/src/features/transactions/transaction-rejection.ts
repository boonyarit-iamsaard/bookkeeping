import type {
  TransactionField,
  TransactionRejected,
  TransactionRejection,
} from "@bookkeeping/application/transactions";
import * as z from "zod";
import {
  defineCodeTable,
  toFieldErrors,
} from "../../core/http/field-rejections.js";
import { moneySchema, presentMoney } from "../../core/http/money.js";

/** Where each rejected input lives in a create request document. */
export const CREATE_FIELD_POINTERS: Readonly<Record<TransactionField, string>> =
  {
    type: "#/type",
    walletId: "#/walletId",
    destinationWalletId: "#/destinationWalletId",
    categoryId: "#/categoryId",
    refundOfTransactionId: "#/refundOfTransactionId",
    amount: "#/amount/value",
    transactionDate: "#/transactionDate",
    note: "#/note",
    tagIds: "#/tagIds",
  };

// The update request names no type or refund link: a contradiction with the
// fixed type addresses the whole document.
export const UPDATE_FIELD_POINTERS: Readonly<Record<TransactionField, string>> =
  {
    ...CREATE_FIELD_POINTERS,
    type: "#/",
    refundOfTransactionId: "#/",
  };

/**
 * Every transaction rule code, published as is or with the facts its message
 * names. A new rejection fails to compile until it has an entry here.
 */
export const transactionCodes = defineCodeTable<TransactionRejection>(
  "Transaction",
  {
    "wallet-not-found": "plain",
    "destination-wallet-not-found": "plain",
    "same-wallet": "plain",
    "wallet-archived": "plain",
    "invalid-transfer": "plain",
    "category-not-found": "plain",
    "category-kind-mismatch": "plain",
    "amount-out-of-range": "plain",
    "note-too-long": "plain",
    "too-many-tags": "plain",
    "tag-not-found": "plain",
    "invalid-date": "plain",
    "future-date": "plain",
    "invalid-refund": "plain",
    "expense-not-found": "plain",
    "exceeds-refundable": {
      facts: {
        /** What the expense has left to refund, not counting the refund being corrected. */
        refundAllowance: moneySchema,
      },
      project: ({ refundAllowance }) => ({
        refundAllowance: presentMoney({
          amountInMinorUnits: refundAllowance,
          currency: "THB",
        }),
      }),
    },
    "below-refunded": {
      facts: {
        /** What the expense's current refunds add up to. */
        refundedTotal: moneySchema,
      },
      project: ({ refundedTotal }) => ({
        refundedTotal: presentMoney({
          amountInMinorUnits: refundedTotal,
          currency: "THB",
        }),
      }),
    },
    "after-refund": {
      facts: {
        /** The earliest linked refund's date. */
        refundDate: z.iso.date(),
      },
      project: ({ refundDate }) => ({ refundDate }),
    },
    "before-expense": {
      facts: {
        /** The refunded expense's date. */
        expenseDate: z.iso.date(),
      },
      project: ({ expenseDate }) => ({ expenseDate }),
    },
    "before-opening": {
      facts: {
        /** The date the rejected wallet's tracked history begins. */
        openingDate: z.iso.date(),
      },
      project: ({ openingDate }) => ({ openingDate }),
    },
  },
);

export const transactionRejectionProblemSchema = transactionCodes.problemSchema;

/** The field errors of a refused create, pointing into the create document. */
export function toCreateFieldErrors(rejected: Readonly<TransactionRejected>) {
  return toFieldErrors(rejected, {
    pointers: CREATE_FIELD_POINTERS,
    codes: transactionCodes,
  });
}

/** The field errors of a refused update, pointing into the update document. */
export function toUpdateFieldErrors(rejected: Readonly<TransactionRejected>) {
  return toFieldErrors(rejected, {
    pointers: UPDATE_FIELD_POINTERS,
    codes: transactionCodes,
  });
}
