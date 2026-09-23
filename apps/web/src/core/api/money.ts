import { formatMoneyInput, parseMoneyInput } from "@bookkeeping/domain/money";
import type { components } from "./openapi.gen";

export type ApiMoney = components["schemas"]["Money"];

/** Converts the API's exact decimal representation to the domain integer. */
export function parseApiMoney(amount: Readonly<ApiMoney>): bigint {
  const parsed = parseMoneyInput({
    text: amount.value,
    currency: amount.currency,
  });
  if (!parsed.ok) {
    throw new Error("The API returned an invalid money value");
  }
  return parsed.value;
}

/** Formats an API money value for an editable amount field. */
export function formatApiMoneyInput(amount: Readonly<ApiMoney>): string {
  return formatMoneyInput({
    amountInMinorUnits: parseApiMoney(amount),
    currency: amount.currency,
  });
}
