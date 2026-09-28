import type { CalendarDate } from "@bookkeeping/domain/dates";
import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { formatMoney } from "@bookkeeping/domain/money";
import * as z from "zod";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import type { ApiFieldError } from "@/core/api/write-submission";
import { createFieldOf } from "@/core/api/write-submission";

type Schemas = components["schemas"];

/** Every reason the API refuses a transaction command, as it publishes them. */
export type TransactionRejectionCode =
  | Schemas["TransactionRuleFieldError"]["code"]
  | Schemas["RefundAllowanceFieldError"]["code"]
  | Schemas["RefundedTotalFieldError"]["code"]
  | Schemas["RefundDateFieldError"]["code"]
  | Schemas["ExpenseDateFieldError"]["code"]
  | Schemas["OpeningDateFieldError"]["code"];

export type TransactionFormField =
  | "amount"
  | "walletId"
  | "destinationWalletId"
  | "categoryId"
  | "transactionDate"
  | "note";

export const TRANSACTION_FORM_FIELDS: readonly TransactionFormField[] = [
  "amount",
  "walletId",
  "destinationWalletId",
  "categoryId",
  "transactionDate",
  "note",
];

/** A rejection addressed to any other input, such as the type or the refunded expense, goes to the error bar. */
export const transactionFieldOf = createFieldOf(TRANSACTION_FORM_FIELDS);

function formatBaht(amountInMinorUnits: bigint): string {
  return formatMoney({ amountInMinorUnits, currency: "THB" });
}

export function refundAllowanceMessage(refundAllowance: bigint): string {
  return refundAllowance > 0n
    ? `Only ${formatBaht(refundAllowance)} of this expense is left to refund`
    : "This expense is already fully refunded";
}

export function beforeExpenseMessage(expenseDate: CalendarDate): string {
  return `The expense is dated ${formatCalendarDate(expenseDate)}; a refund cannot come before it`;
}

export function beforeOpeningMessage(openingDate: CalendarDate): string {
  return `This wallet opened on ${formatCalendarDate(openingDate)}; earlier dates are not tracked`;
}

const moneySchema = z.object({ value: z.string(), currency: z.literal("THB") });

// Facts arrive in an API response, so they are parsed rather than trusted;
// a missing or malformed fact falls back to the code's plain message.
const factsSchema = z.discriminatedUnion("code", [
  z.object({
    code: z.literal("exceeds-refundable"),
    refundAllowance: moneySchema,
  }),
  z.object({ code: z.literal("below-refunded"), refundedTotal: moneySchema }),
  z.object({ code: z.literal("after-refund"), refundDate: z.iso.date() }),
  z.object({ code: z.literal("before-expense"), expenseDate: z.iso.date() }),
  z.object({ code: z.literal("before-opening"), openingDate: z.iso.date() }),
]);

function describeFacts(
  fieldError: Readonly<ApiFieldError>,
): string | undefined {
  const parsed = factsSchema.safeParse(fieldError);
  if (!parsed.success) {
    return undefined;
  }
  const facts = parsed.data;
  switch (facts.code) {
    case "exceeds-refundable":
      return refundAllowanceMessage(parseApiMoney(facts.refundAllowance));
    case "below-refunded":
      return `${formatBaht(parseApiMoney(facts.refundedTotal))} of this expense has been refunded; the amount cannot go below that`;
    case "after-refund":
      return `A linked refund is dated ${formatCalendarDate(facts.refundDate)}; the expense cannot come after it`;
    case "before-expense":
      return beforeExpenseMessage(facts.expenseDate);
    case "before-opening":
      return beforeOpeningMessage(facts.openingDate);
  }
}

// Keyed by every published code, so a new rejection fails to compile until
// it has a message. Codes with facts use these only when a fact is missing.
const REJECTION_MESSAGES: Record<TransactionRejectionCode, string> = {
  "wallet-not-found": "That wallet is not available. Choose another wallet.",
  "destination-wallet-not-found":
    "That destination wallet is not available. Choose another wallet.",
  "wallet-archived":
    "That wallet is archived. Choose an active wallet or retain this transaction’s existing wallets.",
  "same-wallet":
    "Choose two different available wallets. Transfers have no category.",
  "invalid-transfer":
    "Choose two different available wallets. Transfers have no category.",
  "category-not-found":
    "That category is not available for this type. Choose another.",
  "category-kind-mismatch":
    "That category is not available for this type. Choose another.",
  "amount-out-of-range": "The amount must be between ฿0.01 and ฿99,999,999.99",
  "note-too-long": "Notes can be at most 200 characters",
  "invalid-date": "Enter a real calendar date",
  "future-date": "The date cannot be in the future",
  "invalid-refund": "Only a current expense can be refunded",
  "expense-not-found": "This expense no longer exists, so it can't be refunded",
  "exceeds-refundable":
    "The amount is more than this expense has left to refund",
  "below-refunded":
    "Part of this expense has been refunded; the amount cannot go below that",
  "after-refund":
    "This expense has a linked refund; the expense cannot come after it",
  "before-expense": "A refund cannot come before its expense",
  "before-opening": "Earlier dates than this wallet's opening are not tracked",
};

function isRejectionCode(code: string): code is TransactionRejectionCode {
  return Object.hasOwn(REJECTION_MESSAGES, code);
}

/** The message for one refused input, worded from the facts the API sent with it. */
export function describeTransactionFieldError(
  fieldError: Readonly<ApiFieldError>,
): string {
  const { code, detail } = fieldError;
  return (
    describeFacts(fieldError) ??
    detail ??
    (isRejectionCode(code) ? REJECTION_MESSAGES[code] : undefined) ??
    "This value was not accepted."
  );
}

/** Whether the rejection named a figure or date the page may have loaded stale. */
export function carriesFacts(fieldError: Readonly<ApiFieldError>): boolean {
  return factsSchema.safeParse(fieldError).success;
}
