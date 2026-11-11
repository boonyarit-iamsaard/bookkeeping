import type { MoneyAmount } from "@bookkeeping/domain/money";
import { formatMoneyInput, parseMoneyInput } from "@bookkeeping/domain/money";
import * as z from "zod";
import type { components } from "./openapi.gen";

export type ApiMoney = components["schemas"]["Money"];

function parseWireValue(amount: Readonly<ApiMoney>) {
  return parseMoneyInput({ text: amount.value, currency: amount.currency });
}

/** Converts the API's exact decimal representation to the domain integer. */
export function parseApiMoney(amount: Readonly<ApiMoney>): bigint {
  const parsed = parseWireValue(amount);
  if (!parsed.ok) {
    throw new Error("The API returned an invalid money value");
  }
  return parsed.value;
}

/** Converts integer minor units to the API's exact decimal representation. */
export function presentApiMoney({
  amountInMinorUnits,
  currency,
}: Readonly<MoneyAmount>): ApiMoney {
  return {
    value: formatMoneyInput({ amountInMinorUnits, currency }),
    currency,
  };
}

/** Parses a wire amount inside an untyped body, such as problem facts, to minor units. */
export const apiMoneySchema = z
  .object({ value: z.string(), currency: z.literal("THB") })
  .transform((amount, ctx) => {
    const parsed = parseWireValue(amount);
    if (!parsed.ok) {
      ctx.addIssue({ code: "custom", path: ["value"], message: parsed.error });
      return z.NEVER;
    }
    return parsed.value;
  });

/** Formats an API money value for an editable amount field. */
export function formatApiMoneyInput(amount: Readonly<ApiMoney>): string {
  return formatMoneyInput({
    amountInMinorUnits: parseApiMoney(amount),
    currency: amount.currency,
  });
}
