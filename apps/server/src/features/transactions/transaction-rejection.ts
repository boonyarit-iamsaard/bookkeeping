import type {
  TransactionField,
  TransactionRejection,
} from "@bookkeeping/application/transactions";
import * as z from "zod";
import { moneySchema, presentMoney } from "../../core/http/money.js";
import { describeProblemAs } from "../../core/http/openapi.js";
import {
  getProblemOptionsForStatus,
  problemDetailsSchema,
  problemFieldErrorSchema,
} from "../../core/http/problem-details.js";

/** Where each rejected input lives in a create request document. */
export const CREATE_FIELD_POINTERS: Record<TransactionField, string> = {
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
export const UPDATE_FIELD_POINTERS: Record<TransactionField, string> = {
  ...CREATE_FIELD_POINTERS,
  type: "#/",
  refundOfTransactionId: "#/",
};

/** The rejections whose message names a figure or date: each carries that fact. */
type FactualRejectionCode =
  | "exceeds-refundable"
  | "below-refunded"
  | "after-refund"
  | "before-expense"
  | "before-opening";

type PlainRejectionCode = Exclude<
  TransactionRejection["code"],
  FactualRejectionCode
>;

// Keyed by every plain code, so a new rejection fails to compile until it is
// published here or given its facts.
const PLAIN_REJECTION_CODES: { [Code in PlainRejectionCode]: Code } = {
  "wallet-not-found": "wallet-not-found",
  "destination-wallet-not-found": "destination-wallet-not-found",
  "same-wallet": "same-wallet",
  "wallet-archived": "wallet-archived",
  "invalid-transfer": "invalid-transfer",
  "category-not-found": "category-not-found",
  "category-kind-mismatch": "category-kind-mismatch",
  "amount-out-of-range": "amount-out-of-range",
  "note-too-long": "note-too-long",
  "too-many-tags": "too-many-tags",
  "tag-not-found": "tag-not-found",
  "invalid-date": "invalid-date",
  "future-date": "future-date",
  "invalid-refund": "invalid-refund",
  "expense-not-found": "expense-not-found",
};

const refundAllowanceFieldErrorSchema = problemFieldErrorSchema
  .extend({
    code: z.literal("exceeds-refundable"),
    /** What the expense has left to refund, not counting the refund being corrected. */
    refundAllowance: moneySchema,
  })
  .meta({ id: "RefundAllowanceFieldError" });

const refundedTotalFieldErrorSchema = problemFieldErrorSchema
  .extend({
    code: z.literal("below-refunded"),
    /** What the expense's current refunds add up to. */
    refundedTotal: moneySchema,
  })
  .meta({ id: "RefundedTotalFieldError" });

const refundDateFieldErrorSchema = problemFieldErrorSchema
  .extend({
    code: z.literal("after-refund"),
    /** The earliest linked refund's date. */
    refundDate: z.iso.date(),
  })
  .meta({ id: "RefundDateFieldError" });

const expenseDateFieldErrorSchema = problemFieldErrorSchema
  .extend({
    code: z.literal("before-expense"),
    /** The refunded expense's date. */
    expenseDate: z.iso.date(),
  })
  .meta({ id: "ExpenseDateFieldError" });

const openingDateFieldErrorSchema = problemFieldErrorSchema
  .extend({
    code: z.literal("before-opening"),
    /** The date the rejected wallet's tracked history begins. */
    openingDate: z.iso.date(),
  })
  .meta({ id: "OpeningDateFieldError" });

const plainRuleFieldErrorSchema = problemFieldErrorSchema
  .extend({ code: z.enum(PLAIN_REJECTION_CODES) })
  .meta({ id: "PlainRuleFieldError" });

/** A rule rejection keyed by its code, carrying exactly the facts that code names. */
const transactionRuleFieldErrorSchema = z
  .discriminatedUnion("code", [
    refundAllowanceFieldErrorSchema,
    refundedTotalFieldErrorSchema,
    refundDateFieldErrorSchema,
    expenseDateFieldErrorSchema,
    openingDateFieldErrorSchema,
    plainRuleFieldErrorSchema,
  ])
  .meta({ id: "TransactionRuleFieldError" });

const FACTUAL_REJECTION_CODES: { [Code in FactualRejectionCode]: Code } = {
  "exceeds-refundable": "exceeds-refundable",
  "below-refunded": "below-refunded",
  "after-refund": "after-refund",
  "before-expense": "before-expense",
  "before-opening": "before-opening",
};

const RULE_REJECTION_CODES: ReadonlySet<string> = new Set([
  ...Object.values(PLAIN_REJECTION_CODES),
  ...Object.values(FACTUAL_REJECTION_CODES),
]);

/** A request validation error; a rule code never passes as one, so its facts cannot go missing. */
const transactionValidationFieldErrorSchema = problemFieldErrorSchema
  .refine((fieldError) => !RULE_REJECTION_CODES.has(fieldError.code))
  .meta({ id: "TransactionValidationFieldError" });

/**
 * A field error in a rejected transaction command: a rule rejection, with the
 * facts its message names, or a request validation error.
 */
export const transactionFieldErrorSchema = z
  .union([
    transactionRuleFieldErrorSchema,
    transactionValidationFieldErrorSchema,
  ])
  .meta({ id: "TransactionFieldError" });

export const transactionRejectionProblemSchema = problemDetailsSchema
  .extend({ errors: z.array(transactionFieldErrorSchema).optional() })
  .meta({ id: "TransactionRejectionProblem" });

export type TransactionFieldError = z.infer<typeof transactionFieldErrorSchema>;

/** The documented 422 a rejected create or update answers. */
export function describeTransactionRejection() {
  return describeProblemAs(
    getProblemOptionsForStatus(422),
    transactionRejectionProblemSchema,
  );
}

export function toFieldErrors(
  rejection: Readonly<TransactionRejection>,
  pointers: Readonly<Record<TransactionField, string>>,
): TransactionFieldError[] {
  const pointer = pointers[rejection.field];
  switch (rejection.code) {
    case "exceeds-refundable":
      return [
        {
          pointer,
          code: rejection.code,
          refundAllowance: presentMoney({
            amountInMinorUnits: rejection.refundAllowance,
            currency: "THB",
          }),
        },
      ];
    case "below-refunded":
      return [
        {
          pointer,
          code: rejection.code,
          refundedTotal: presentMoney({
            amountInMinorUnits: rejection.refundedTotal,
            currency: "THB",
          }),
        },
      ];
    case "after-refund":
      return [
        { pointer, code: rejection.code, refundDate: rejection.refundDate },
      ];
    case "before-expense":
      return [
        { pointer, code: rejection.code, expenseDate: rejection.expenseDate },
      ];
    case "before-opening":
      return [
        { pointer, code: rejection.code, openingDate: rejection.openingDate },
      ];
    default:
      return [{ pointer, code: PLAIN_REJECTION_CODES[rejection.code] }];
  }
}
