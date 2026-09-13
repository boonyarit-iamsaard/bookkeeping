import * as z from "zod";
import { TRANSACTION_TYPES } from "@/core/database/schema/transaction-type";
import {
  MAX_NOTE_LENGTH,
  MAX_TRANSACTION_AMOUNT,
  MIN_TRANSACTION_AMOUNT,
} from "@/features/transactions/money-limits";
import type { CalendarDate } from "@/shared/helpers/dates";
import {
  APP_TIME_ZONE,
  formatCalendarDate,
  parseCalendarDate,
  todayIn,
} from "@/shared/helpers/dates";
import type { MoneyParseError } from "@/shared/helpers/money";
import { formatMoney, parseMoneyInput } from "@/shared/helpers/money";

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
}

function transactionFields() {
  return {
    type: z.enum(TRANSACTION_TYPES, { error: "Choose income or expense" }),
    walletId: z.string().min(1, "Choose a wallet"),
    categoryId: z.string().min(1, "Choose a category"),
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

function openingDateCheck(
  walletOpeningDates: Readonly<Record<string, CalendarDate>>,
) {
  return (
    value: { walletId: string; transactionDate: string },
    ctx: z.RefinementCtx,
  ) => {
    const openingDate = walletOpeningDates[value.walletId];
    if (openingDate && value.transactionDate < openingDate) {
      ctx.addIssue({
        code: "custom",
        path: ["transactionDate"],
        message: `This wallet opened on ${formatCalendarDate(openingDate)}; earlier dates are not tracked`,
      });
    }
  };
}

/**
 * Parses the create-transaction form. Amounts arrive as the typed string and
 * leave as integer satang; the same fields are parsed again in the action.
 */
export function createTransactionFormSchema({
  walletOpeningDates = {},
}: Readonly<TransactionFormSchemaOptions> = {}) {
  return z
    .object(transactionFields())
    .superRefine(openingDateCheck(walletOpeningDates));
}

/** What the client actually sends: the form values plus the submission key. */
export function createTransactionSubmissionSchema() {
  return z.object({
    ...transactionFields(),
    submissionKey: z.string().min(1),
  });
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
