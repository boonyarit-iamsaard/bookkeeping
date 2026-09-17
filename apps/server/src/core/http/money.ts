import type { Currency } from "@bookkeeping/domain/money";
import {
  formatMoneyInput,
  MAX_WHOLE_DIGITS,
  parseMoneyInput,
} from "@bookkeeping/domain/money";
import * as z from "zod";

/** A supported currency code; THB is the only one while the product is Thai-only. */
export const currencySchema = z.enum(["THB"]).meta({ id: "Currency" });

/**
 * The wire form of an amount: an exact major-unit decimal string beside its
 * currency. Responses always carry two fractional digits for THB.
 */
export const moneySchema = z
  .object({
    value: z.string().regex(/^-?\d+\.\d{2}$/),
    currency: currencySchema,
  })
  .meta({ id: "Money" });

export type Money = z.infer<typeof moneySchema>;

/** Converts integer minor units to the canonical wire form without touching `number`. */
export function presentMoney({
  amountInMinorUnits,
  currency,
}: Readonly<MoneyAmount>): Money {
  return {
    value: formatMoneyInput({ amountInMinorUnits, currency }),
    currency,
  };
}

// Plain ASCII base-10 notation: an optional minus, the domain's whole-digit
// limit, and up to two fractional digits. No grouping, exponent, symbol, or
// surrounding space.
const MONEY_INPUT_PATTERN = new RegExp(
  `^-?\\d{1,${MAX_WHOLE_DIGITS}}(?:\\.\\d{1,2})?$`,
);

export interface MoneyAmount {
  amountInMinorUnits: bigint;
  currency: Currency;
}

/**
 * The wire form of an amount a client sends. The decimal string is parsed to
 * integer minor units directly, never through a JavaScript number, so the
 * handler receives exact satang.
 */
export const moneyInputSchema = z
  .object({
    value: z.string().regex(MONEY_INPUT_PATTERN),
    currency: currencySchema,
  })
  .meta({ id: "MoneyInput" })
  .transform((money, ctx): MoneyAmount => {
    const parsed = parseMoneyInput({
      text: money.value,
      currency: money.currency,
    });
    if (!parsed.ok) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `Amount is ${parsed.error}`,
        params: { code: parsed.error },
      });
      return z.NEVER;
    }
    return { amountInMinorUnits: parsed.value, currency: money.currency };
  });
