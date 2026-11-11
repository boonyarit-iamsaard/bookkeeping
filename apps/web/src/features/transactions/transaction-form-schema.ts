import type { CalendarDate } from "@bookkeeping/domain/dates";
import {
  APP_TIME_ZONE,
  parseCalendarDate,
  todayIn,
} from "@bookkeeping/domain/dates";
import type { MoneyParseError } from "@bookkeeping/domain/money";
import { parseMoneyInput } from "@bookkeeping/domain/money";
import {
  MAX_NOTE_LENGTH,
  MAX_TRANSACTION_AMOUNT,
  MIN_TRANSACTION_AMOUNT,
  TRANSACTION_TYPES,
} from "@bookkeeping/domain/transactions";
import * as z from "zod";
import type { TransactionRejection } from "@/features/transactions/transaction-rejection";
import { describeTransactionRejection } from "@/features/transactions/transaction-rejection";

// An unreadable amount has no server rule; its own wording stays here. An
// amount too long to read is out of range, which the server words.
const UNREADABLE_AMOUNT_MESSAGES: Record<
  Exclude<MoneyParseError, "too-large">,
  string
> = {
  empty: "Enter an amount, for example 120 or 85.50",
  invalid: "Enter an amount in baht, for example 85.50",
  "too-many-decimals": "Use at most two decimals; satang is the smallest unit",
};

/**
 * A hint that mirrors a server rule: the message is that rule's, asked by code
 * and facts, and the issue keeps both so the form can be tested on what it asks.
 */
function mirroredHint(rejection: TransactionRejection) {
  return {
    message: describeTransactionRejection(rejection),
    params: { rejection },
  };
}

/**
 * Hints for a required input left empty. They are shape-only: no server rule
 * stands behind them, so they stay local and are never mirrored. The
 * destination's is not the `same-wallet` rule, which is mirrored below.
 */
const REQUIRED_FIELD_HINTS = {
  destinationWalletId: "Choose a destination wallet",
  categoryId: "Choose a category",
} as const;

interface TransactionFormSchemaOptions {
  /**
   * Opening dates of the wallets offered, so the form can name the date
   * inline. The server re-checks against the stored wallet regardless.
   */
  walletOpeningDates?: Readonly<Record<string, CalendarDate>>;
  /** The expense a refund is entered against, for inline date and limit checks. */
  linkedExpense?: LinkedExpenseLimits;
}

export interface LinkedExpenseLimits {
  transactionDate: CalendarDate;
  /** What is left to refund, excluding the refund being edited. */
  refundAllowance: bigint;
}

function transactionFields() {
  return {
    type: z.enum(TRANSACTION_TYPES, {
      error: "Choose income, expense, or transfer",
    }),
    walletId: z.string().min(1, "Choose a wallet"),
    currency: z.literal("THB", { error: "Currency must be THB" }),
    destinationWalletId: z.string().default(""),
    refundOfTransactionId: z.string().default(""),
    categoryId: z.string(),
    amount: z.string().transform((raw, ctx) => {
      const result = parseMoneyInput({ text: raw, currency: "THB" });
      const outOfRange = mirroredHint({ code: "amount-out-of-range" });
      if (!result.ok) {
        ctx.addIssue(
          result.error === "too-large"
            ? { code: "custom", ...outOfRange }
            : {
                code: "custom",
                message: UNREADABLE_AMOUNT_MESSAGES[result.error],
              },
        );
        return z.NEVER;
      }
      if (
        result.value < MIN_TRANSACTION_AMOUNT ||
        result.value > MAX_TRANSACTION_AMOUNT
      ) {
        ctx.addIssue({ code: "custom", ...outOfRange });
        return z.NEVER;
      }
      return result.value;
    }),
    transactionDate: z
      .string()
      .refine((value) => parseCalendarDate(value).ok, "Enter the date")
      .refine(
        (value) => value <= todayIn({ timeZone: APP_TIME_ZONE }),
        mirroredHint({ code: "future-date" }),
      ),
    note: z
      .string()
      .refine(
        (value) => value.length <= MAX_NOTE_LENGTH,
        mirroredHint({ code: "note-too-long" }),
      ),
    // The picker keeps the set within the limit; the API owns that rule.
    tagIds: z.array(z.string()),
  };
}

interface TransactionFieldValues {
  type: string;
  walletId: string;
  destinationWalletId: string;
  refundOfTransactionId: string;
  categoryId: string;
  amount: bigint;
  transactionDate: string;
}

interface RefundFieldCheckOptions {
  value: Readonly<TransactionFieldValues>;
  ctx: z.RefinementCtx;
  linkedExpense?: Readonly<LinkedExpenseLimits>;
}

function checkRefundFields({
  value,
  ctx,
  linkedExpense,
}: Readonly<RefundFieldCheckOptions>) {
  if (!value.refundOfTransactionId) {
    ctx.addIssue({
      code: "custom",
      path: ["refundOfTransactionId"],
      message: "A refund must be recorded from its expense",
    });
  }
  if (linkedExpense && value.amount > linkedExpense.refundAllowance) {
    ctx.addIssue({
      code: "custom",
      path: ["amount"],
      ...mirroredHint({
        code: "exceeds-refundable",
        refundAllowance: linkedExpense.refundAllowance,
      }),
    });
  }
  if (linkedExpense && value.transactionDate < linkedExpense.transactionDate) {
    ctx.addIssue({
      code: "custom",
      path: ["transactionDate"],
      ...mirroredHint({
        code: "before-expense",
        expenseDate: linkedExpense.transactionDate,
      }),
    });
  }
}

function transactionFieldCheck({
  walletOpeningDates = {},
  linkedExpense,
}: Readonly<TransactionFormSchemaOptions>) {
  return (value: Readonly<TransactionFieldValues>, ctx: z.RefinementCtx) => {
    if (value.type === "transfer") {
      if (!value.destinationWalletId) {
        ctx.addIssue({
          code: "custom",
          path: ["destinationWalletId"],
          message: REQUIRED_FIELD_HINTS.destinationWalletId,
        });
      } else if (value.destinationWalletId === value.walletId) {
        ctx.addIssue({
          code: "custom",
          path: ["destinationWalletId"],
          ...mirroredHint({ code: "same-wallet" }),
        });
      }
    } else if (value.type === "refund") {
      checkRefundFields({ value, ctx, linkedExpense });
    } else if (!value.categoryId) {
      ctx.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: REQUIRED_FIELD_HINTS.categoryId,
      });
    }
    const ids =
      value.type === "transfer"
        ? [value.walletId, value.destinationWalletId]
        : [value.walletId];
    for (const id of ids) {
      const openingDate = walletOpeningDates[id];
      if (openingDate && value.transactionDate < openingDate) {
        ctx.addIssue({
          code: "custom",
          path: ["transactionDate"],
          ...mirroredHint({ code: "before-opening", openingDate }),
        });
        break;
      }
    }
  };
}

/**
 * Parses the transaction form, for a new entry or a correction. Amounts
 * arrive as the typed string and leave as integer satang; the same fields
 * are parsed again in the API.
 */
export function createTransactionFormSchema(
  options: Readonly<TransactionFormSchemaOptions> = {},
) {
  return z
    .object(transactionFields())
    .superRefine(transactionFieldCheck(options));
}

export type TransactionFormInput = z.input<
  ReturnType<typeof createTransactionFormSchema>
>;
export type TransactionFormValues = z.output<
  ReturnType<typeof createTransactionFormSchema>
>;
