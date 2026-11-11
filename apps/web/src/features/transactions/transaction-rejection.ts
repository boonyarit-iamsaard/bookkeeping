import type { CalendarDate } from "@bookkeeping/domain/dates";
import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { formatMoney } from "@bookkeeping/domain/money";
import { MAX_TAGS_PER_TRANSACTION } from "@bookkeeping/domain/tags";
import {
  MAX_NOTE_LENGTH,
  MAX_TRANSACTION_AMOUNT,
  MIN_TRANSACTION_AMOUNT,
} from "@bookkeeping/domain/transactions";
import * as z from "zod";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import { createFactualFieldErrorDescriber } from "@/core/api/rejection-wording";
import type { ApiFieldError } from "@/core/api/write-submission";

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
type PublishedFacts<Code extends TransactionRejectionCode> = Omit<
  RuleVariant<Code>,
  "pointer" | "detail"
>;

/** The codes whose published variant carries a fact beside the code. */
type FactualCode = {
  [Code in TransactionRejectionCode]: Exclude<
    keyof PublishedFacts<Code>,
    "code"
  > extends never
    ? never
    : Code;
}[TransactionRejectionCode];

/** The facts each factual code's message reads, as the domain holds them. */
interface TransactionFacts {
  "exceeds-refundable": { refundAllowance: bigint };
  "below-refunded": { refundedTotal: bigint };
  "after-refund": { refundDate: CalendarDate };
  "before-expense": { expenseDate: CalendarDate };
  "before-opening": { openingDate: CalendarDate };
}

type PlainCode = Exclude<TransactionRejectionCode, FactualCode>;

/** A rejection a form hint names: its code with the facts its message reads. */
export type TransactionRejection =
  | { [Code in PlainCode]: { code: Code } }[PlainCode]
  | {
      [Code in FactualCode]: { code: Code } & TransactionFacts[Code];
    }[FactualCode];

export type TransactionFormField =
  | "amount"
  | "walletId"
  | "destinationWalletId"
  | "categoryId"
  | "transactionDate"
  | "note"
  | "tagIds";

/** The fields the form shows; a rejection addressed to any other input, such as the type or the refunded expense, goes to the error bar. */
export const TRANSACTION_FORM_FIELDS: readonly TransactionFormField[] = [
  "amount",
  "walletId",
  "destinationWalletId",
  "categoryId",
  "transactionDate",
  "note",
  "tagIds",
];

function formatBaht(amountInMinorUnits: bigint): string {
  return formatMoney({ amountInMinorUnits, currency: "THB" });
}

const moneySchema = z
  .object({ value: z.string(), currency: z.literal("THB") })
  .transform(parseApiMoney);

/** The published variant's facts in, the domain's facts out. */
type FactReaders = {
  [Code in FactualCode]: z.ZodType<
    TransactionFacts[Code],
    PublishedFacts<Code>
  >;
};

// Keyed by every code whose published variant carries facts. Facts arrive in
// an API response, so they are parsed rather than trusted.
const FACT_READERS: FactReaders = {
  "exceeds-refundable": z.object({
    code: z.literal("exceeds-refundable"),
    refundAllowance: moneySchema,
  }),
  "below-refunded": z.object({
    code: z.literal("below-refunded"),
    refundedTotal: moneySchema,
  }),
  "after-refund": z.object({
    code: z.literal("after-refund"),
    refundDate: z.iso.date(),
  }),
  "before-expense": z.object({
    code: z.literal("before-expense"),
    expenseDate: z.iso.date(),
  }),
  "before-opening": z.object({
    code: z.literal("before-opening"),
    openingDate: z.iso.date(),
  }),
};

function isFactualCode(code: string): code is FactualCode {
  return Object.hasOwn(FACT_READERS, code);
}

function readFacts<Code extends FactualCode>(
  code: Code,
  fieldError: Readonly<ApiFieldError>,
): TransactionFacts[Code] | undefined {
  const reader: FactReaders[Code] = FACT_READERS[code];
  const parsed = reader.safeParse(fieldError);
  return parsed.success ? parsed.data : undefined;
}

const MIN_AMOUNT_TEXT = formatBaht(MIN_TRANSACTION_AMOUNT);
const MAX_AMOUNT_TEXT = formatBaht(MAX_TRANSACTION_AMOUNT);

// Keyed by every published code that names no fact, so a new rejection fails
// to compile until it has a message. Every limit is built from its domain
// constant.
const PLAIN_MESSAGES: Record<PlainCode, string> = {
  "wallet-not-found": "That wallet is not available. Choose another wallet.",
  "destination-wallet-not-found":
    "That destination wallet is not available. Choose another wallet.",
  "wallet-archived":
    "That wallet is archived. Choose an active wallet or retain this transaction’s existing wallets.",
  "same-wallet": "Choose a different destination wallet",
  "invalid-transfer":
    "Choose two different available wallets. Transfers have no category.",
  "category-not-found":
    "That category is not available for this type. Choose another.",
  "category-kind-mismatch":
    "That category is not available for this type. Choose another.",
  "amount-out-of-range": `The amount must be between ${MIN_AMOUNT_TEXT} and ${MAX_AMOUNT_TEXT}`,
  "note-too-long": `Notes can be at most ${MAX_NOTE_LENGTH} characters`,
  "too-many-tags": `A transaction can carry at most ${MAX_TAGS_PER_TRANSACTION} tags`,
  "tag-not-found": "That tag is no longer available. Choose another.",
  "invalid-date": "Enter a real calendar date",
  "future-date": "The date cannot be in the future",
  "invalid-refund": "Only a current expense can be refunded",
  "expense-not-found": "This expense no longer exists, so it can't be refunded",
};

// Keyed by every code whose published variant carries facts; each message is
// worded from them.
const FACTUAL_MESSAGES: {
  [Code in FactualCode]: (facts: TransactionFacts[Code]) => string;
} = {
  "exceeds-refundable": ({ refundAllowance }) =>
    refundAllowance > 0n
      ? `Only ${formatBaht(refundAllowance)} of this expense is left to refund`
      : "This expense is already fully refunded",
  "below-refunded": ({ refundedTotal }) =>
    `${formatBaht(refundedTotal)} of this expense has been refunded; the amount cannot go below that`,
  "after-refund": ({ refundDate }) =>
    `A linked refund is dated ${formatCalendarDate(refundDate)}; the expense cannot come after it`,
  "before-expense": ({ expenseDate }) =>
    `The expense is dated ${formatCalendarDate(expenseDate)}; its refund cannot come before it`,
  "before-opening": ({ openingDate }) =>
    `This wallet's history starts on ${formatCalendarDate(openingDate)}; choose that date or later`,
};

/** The message for one refused input, worded from the facts the API sent with it. */
export const describeTransactionFieldError = createFactualFieldErrorDescriber<
  TransactionRejectionCode,
  TransactionFacts
>({ plain: PLAIN_MESSAGES, factual: FACTUAL_MESSAGES, readFacts });

function describeFactual<Code extends FactualCode>(
  rejection: { code: Code } & TransactionFacts[Code],
): string {
  return FACTUAL_MESSAGES[rejection.code](rejection);
}

function isFactualRejection(
  rejection: TransactionRejection,
): rejection is Extract<TransactionRejection, { code: FactualCode }> {
  return isFactualCode(rejection.code);
}

/**
 * The message for a rejection a form hint names by its code and facts, so the
 * hint says what the server would say.
 */
export function describeTransactionRejection(
  rejection: TransactionRejection,
): string {
  return isFactualRejection(rejection)
    ? describeFactual(rejection)
    : PLAIN_MESSAGES[rejection.code];
}

/** Whether the rejection named a figure or date the page may have loaded stale. */
export function carriesFacts(fieldError: Readonly<ApiFieldError>): boolean {
  return (
    isFactualCode(fieldError.code) &&
    readFacts(fieldError.code, fieldError) !== undefined
  );
}
