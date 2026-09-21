import type { Currency } from "@bookkeeping/domain/money";
import {
  formatMoney,
  formatMoneyInput,
  formatMoneyParts,
  parseMoneyInput,
} from "@bookkeeping/domain/money";
import type { components } from "@/core/api/openapi.gen";
import { cn } from "@/shared/helpers/cn";

type ApiMoney = components["schemas"]["Money"];

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

interface MoneyProps {
  amount: ApiMoney;
  /** Display figures step the currency symbol and fraction down. */
  display?: boolean;
  className?: string;
}

/** A THB figure with tabular numerals, always two decimals. */
export function Money({
  amount,
  display = false,
  className,
}: Readonly<MoneyProps>) {
  const amountInMinorUnits = parseApiMoney(amount);
  const currency: Currency = amount.currency;

  if (!display) {
    return (
      <span className={cn("money", className)} translate="no">
        {formatMoney({ amountInMinorUnits, currency })}
      </span>
    );
  }

  const parts = formatMoneyParts({ amountInMinorUnits, currency });
  return (
    <span className={cn("money", className)} translate="no">
      <span className="sr-only">
        {formatMoney({ amountInMinorUnits, currency })}
      </span>
      <span aria-hidden="true">
        {parts.sign}
        <span className="font-medium text-[0.6em] text-muted-foreground">
          {parts.symbol}
        </span>
        {parts.whole}
        <span className="font-medium text-[0.6em] text-muted-foreground">
          .{parts.fraction}
        </span>
      </span>
    </span>
  );
}
