import type { Currency } from "@bookkeeping/domain/money";
import { formatMoney, formatMoneyParts } from "@bookkeeping/domain/money";
import type { ApiMoney } from "@/core/api/api-money";
import { parseApiMoney } from "@/core/api/api-money";
import { cn } from "@/shared/helpers/cn";

interface MoneyProps {
  amount: ApiMoney;
  /** Prefixed as given, such as "−" when the figure's meaning carries it. */
  sign?: string;
  /** Display figures step the currency symbol and fraction down. */
  display?: boolean;
  className?: string;
}

/** A THB figure with tabular numerals, always two decimals. */
export function Money({
  amount,
  sign = "",
  display = false,
  className,
}: Readonly<MoneyProps>) {
  const amountInMinorUnits = parseApiMoney(amount);
  const currency: Currency = amount.currency;

  if (!display) {
    return (
      <span className={cn("money", className)} translate="no">
        {sign}
        {formatMoney({ amountInMinorUnits, currency })}
      </span>
    );
  }

  const parts = formatMoneyParts({ amountInMinorUnits, currency });
  return (
    <span className={cn("money", className)} translate="no">
      <span className="sr-only">
        {sign}
        {formatMoney({ amountInMinorUnits, currency })}
      </span>
      <span aria-hidden="true">
        {sign}
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
