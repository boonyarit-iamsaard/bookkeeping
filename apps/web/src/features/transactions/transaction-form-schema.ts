import type { CalendarDate } from "@bookkeeping/domain/dates";
import {
  APP_TIME_ZONE,
  formatCalendarDate,
  parseCalendarDate,
  todayIn,
} from "@bookkeeping/domain/dates";
import type { MoneyParseError } from "@bookkeeping/domain/money";
import { formatMoney, parseMoneyInput } from "@bookkeeping/domain/money";
import {
  MAX_NOTE_LENGTH,
  MAX_TRANSACTION_AMOUNT,
  MIN_TRANSACTION_AMOUNT,
  TRANSACTION_TYPES,
} from "@bookkeeping/domain/transactions";
import * as z from "zod";

const AMOUNT_MESSAGES: Record<MoneyParseError, string> = {
  empty: "Enter an amount, for example 120 or 85.50",
  invalid: "Enter an amount in baht, for example 85.50",
  "too-many-decimals": "Use at most two decimals; satang is the smallest unit",
  "too-large": "Amounts can be at most ฿99,999,999.99",
};

const MIN_AMOUNT_TEXT = formatMoney({
  amountInMinorUnits: MIN_TRANSACTION_AMOUNT,
  currency: "THB",
});
const MAX_AMOUNT_TEXT = formatMoney({
  amountInMinorUnits: MAX_TRANSACTION_AMOUNT,
  currency: "THB",
});

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
  remaining: bigint;
}

/** What an expense's current refunds hold it to, as the API reports them. */
export interface ExpenseRefundLimits {
  refundedTotal: bigint;
  /** The earliest linked refund's date; the expense cannot come after it. */
  earliestRefundDate?: CalendarDate;
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
      if (!result.ok) {
        ctx.addIssue({
          code: "custom",
          message: AMOUNT_MESSAGES[result.error],
        });
        return z.NEVER;
      }
      if (result.value < MIN_TRANSACTION_AMOUNT) {
        ctx.addIssue({
          code: "custom",
          message: `The amount must be at least ${MIN_AMOUNT_TEXT}`,
        });
        return z.NEVER;
      }
      if (result.value > MAX_TRANSACTION_AMOUNT) {
        ctx.addIssue({
          code: "custom",
          message: `Amounts can be at most ${MAX_AMOUNT_TEXT}`,
        });
        return z.NEVER;
      }
      return result.value;
    }),
    transactionDate: z
      .string()
      .refine((value) => parseCalendarDate(value).ok, "Enter the date")
      .refine(
        (value) => value <= todayIn({ timeZone: APP_TIME_ZONE }),
        "The date cannot be in the future",
      ),
    note: z
      .string()
      .max(
        MAX_NOTE_LENGTH,
        `Notes can be at most ${MAX_NOTE_LENGTH} characters`,
      ),
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
  if (linkedExpense && value.amount > linkedExpense.remaining) {
    ctx.addIssue({
      code: "custom",
      path: ["amount"],
      message:
        linkedExpense.remaining > 0n
          ? `Only ${formatMoney({ amountInMinorUnits: linkedExpense.remaining, currency: "THB" })} of this expense is left to refund`
          : "This expense is already fully refunded",
    });
  }
  if (linkedExpense && value.transactionDate < linkedExpense.transactionDate) {
    ctx.addIssue({
      code: "custom",
      path: ["transactionDate"],
      message: `The expense is dated ${formatCalendarDate(linkedExpense.transactionDate)}; a refund cannot come before it`,
    });
  }
}

function transactionFieldCheck({
  walletOpeningDates = {},
  linkedExpense,
}: Readonly<TransactionFormSchemaOptions>) {
  return (value: Readonly<TransactionFieldValues>, ctx: z.RefinementCtx) => {
    if (value.type === "transfer") {
      if (
        !value.destinationWalletId ||
        value.destinationWalletId === value.walletId
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["destinationWalletId"],
          message: "Choose a different destination wallet",
        });
      }
    } else if (value.type === "refund") {
      checkRefundFields({ value, ctx, linkedExpense });
    } else if (!value.categoryId) {
      ctx.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Choose a category",
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
          message: `This wallet opened on ${formatCalendarDate(openingDate)}; earlier dates are not tracked`,
        });
        break;
      }
    }
  };
}

/**
 * Parses the create-transaction form. Amounts arrive as the typed string and
 * leave as integer satang; the same fields are parsed again in the API.
 */
export function createTransactionFormSchema(
  options: Readonly<TransactionFormSchemaOptions> = {},
) {
  return z
    .object(transactionFields())
    .superRefine(transactionFieldCheck(options));
}

/** What the client actually sends: the form values plus the submission key. */
export function createTransactionSubmissionSchema() {
  return z
    .object({
      ...transactionFields(),
      submissionKey: z.string().min(1),
    })
    .superRefine(transactionFieldCheck({}));
}

/**
 * An edit carries the record's id and every field but the type, which is
 * fixed once saved; a `type` in the payload is dropped, never applied.
 */
export function updateTransactionSubmissionSchema() {
  const { type: _fixed, ...editable } = transactionFields();
  return z.object({ ...editable, id: z.string().min(1) });
}

export type TransactionFormInput = z.input<
  ReturnType<typeof createTransactionFormSchema>
>;
export type TransactionFormValues = z.output<
  ReturnType<typeof createTransactionFormSchema>
>;
