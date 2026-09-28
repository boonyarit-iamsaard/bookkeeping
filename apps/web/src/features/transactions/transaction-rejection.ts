import type { CalendarDate } from "@bookkeeping/domain/dates";
import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { formatMoney } from "@bookkeeping/domain/money";
import * as z from "zod";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import type { ApiFieldError } from "@/core/api/write-submission";
import { createFieldOf } from "@/core/api/write-submission";

/** A rule rejection as the API publishes it, keyed by code. */
type RuleFieldError = components["schemas"]["TransactionRuleFieldError"];

/** Every reason the API refuses a transaction command, as it publishes them. */
export type TransactionRejectionCode = RuleFieldError["code"];

/** The published variant a code belongs to; several plain codes share one. */
type RuleVariant<Code extends TransactionRejectionCode> =
  RuleFieldError extends infer Variant
    ? Variant extends { code: infer Codes }
      ? Code extends Codes
        ? Variant
        : never
      : never
    : never;

/** The code and the facts its message names. */
type FactsOf<Code extends TransactionRejectionCode> = Omit<
  RuleVariant<Code>,
  "pointer" | "detail"
>;

/** The codes whose published variant carries a fact beside the code. */
type FactualCode = {
  [Code in TransactionRejectionCode]: Exclude<
    keyof FactsOf<Code>,
    "code"
  > extends never
    ? never
    : Code;
}[TransactionRejectionCode];

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
  return `The expense is dated ${formatCalendarDate(expenseDate)}; its refund cannot come before it`;
}

export function beforeOpeningMessage(openingDate: CalendarDate): string {
  return `This wallet's history starts on ${formatCalendarDate(openingDate)}; choose that date or later`;
}

const moneySchema = z.object({ value: z.string(), currency: z.literal("THB") });

interface FactDescriber<Code extends FactualCode> {
  /** Typed by the published variant, so a renamed fact fails to compile. */
  schema: z.ZodType<FactsOf<Code>>;
  describe: (facts: Readonly<FactsOf<Code>>) => string;
}

// Keyed by every code whose published variant carries facts, so a new one
// fails to compile until it is described here. Facts arrive in an API
// response, so they are parsed rather than trusted.
const FACT_DESCRIBERS: { [Code in FactualCode]: FactDescriber<Code> } = {
  "exceeds-refundable": {
    schema: z.object({
      code: z.literal("exceeds-refundable"),
      refundAllowance: moneySchema,
    }),
    describe: ({ refundAllowance }) =>
      refundAllowanceMessage(parseApiMoney(refundAllowance)),
  },
  "below-refunded": {
    schema: z.object({
      code: z.literal("below-refunded"),
      refundedTotal: moneySchema,
    }),
    describe: ({ refundedTotal }) =>
      `${formatBaht(parseApiMoney(refundedTotal))} of this expense has been refunded; the amount cannot go below that`,
  },
  "after-refund": {
    schema: z.object({
      code: z.literal("after-refund"),
      refundDate: z.iso.date(),
    }),
    describe: ({ refundDate }) =>
      `A linked refund is dated ${formatCalendarDate(refundDate)}; the expense cannot come after it`,
  },
  "before-expense": {
    schema: z.object({
      code: z.literal("before-expense"),
      expenseDate: z.iso.date(),
    }),
    describe: ({ expenseDate }) => beforeExpenseMessage(expenseDate),
  },
  "before-opening": {
    schema: z.object({
      code: z.literal("before-opening"),
      openingDate: z.iso.date(),
    }),
    describe: ({ openingDate }) => beforeOpeningMessage(openingDate),
  },
};

function isFactualCode(code: string): code is FactualCode {
  return Object.hasOwn(FACT_DESCRIBERS, code);
}

function describeFactsOf<Code extends FactualCode>(
  code: Code,
  fieldError: Readonly<ApiFieldError>,
): string | undefined {
  const describer: FactDescriber<Code> = FACT_DESCRIBERS[code];
  const parsed = describer.schema.safeParse(fieldError);
  return parsed.success ? describer.describe(parsed.data) : undefined;
}

/** The message its facts word, or `undefined` when the code names none or they are missing. */
function describeFacts(
  fieldError: Readonly<ApiFieldError>,
): string | undefined {
  return isFactualCode(fieldError.code)
    ? describeFactsOf(fieldError.code, fieldError)
    : undefined;
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
  return describeFacts(fieldError) !== undefined;
}
