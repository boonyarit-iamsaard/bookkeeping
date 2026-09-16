import { cn } from "@/shared/helpers/cn";
import type { Currency } from "@/shared/helpers/money";
import { formatMoney, formatMoneyParts } from "@/shared/helpers/money";

interface MoneyProps {
  amountInMinorUnits: bigint;
  currency: Currency;
  /**
   * Display figures step the currency symbol and fraction down so the whole
   * baht leads; row figures stay uniform so columns align.
   */
  display?: boolean;
  className?: string;
}

/** A THB figure with tabular numerals, always two decimals. */
export function Money({
  amountInMinorUnits,
  currency,
  display = false,
  className,
}: Readonly<MoneyProps>) {
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
