import type { Currency } from "@bookkeeping/domain/money";
import { formatMoneyInput } from "@bookkeeping/domain/money";
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

interface MoneyAmount {
  amountInMinorUnits: bigint;
  currency: Currency;
}

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
