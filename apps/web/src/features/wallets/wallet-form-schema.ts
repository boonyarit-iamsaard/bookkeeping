import type { CalendarDate } from "@bookkeeping/domain/dates";
import { parseCalendarDate } from "@bookkeeping/domain/dates";
import type { MoneyParseError } from "@bookkeeping/domain/money";
import { parseMoneyInput } from "@bookkeeping/domain/money";
import { WALLET_TYPES } from "@bookkeeping/domain/wallets";
import * as z from "zod";

const AMOUNT_MESSAGES: Record<MoneyParseError, string> = {
  empty: "Enter an opening balance, for example 12000 or 0",
  invalid: "Enter an amount in baht, for example 12000.50",
  "too-many-decimals": "Use at most two decimals; satang is the smallest unit",
  "too-large": "That amount is larger than the app can store",
};

interface WalletFormSchemaOptions {
  today: CalendarDate;
}

const walletFormFields = {
  name: z.string().trim().min(1, "Enter a wallet name"),
  type: z.enum(WALLET_TYPES, { error: "Choose a wallet type" }),
  savings: z.boolean(),
  openingAmount: z.string().transform((raw, ctx) => {
    const result = parseMoneyInput({ text: raw, currency: "THB" });
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: AMOUNT_MESSAGES[result.error] });
      return z.NEVER;
    }
    return result.value;
  }),
  openingDate: z
    .string()
    .refine((value) => parseCalendarDate(value).ok, "Enter the opening date"),
};

/** Parses the create-wallet form into the exact domain opening amount. */
export function createWalletFormSchema({
  today,
}: Readonly<WalletFormSchemaOptions>) {
  return z.object({
    ...walletFormFields,
    openingDate: walletFormFields.openingDate.refine(
      (value) => value <= today,
      "Opening date cannot be in the future",
    ),
  });
}

export type WalletFormInput = z.input<
  ReturnType<typeof createWalletFormSchema>
>;
