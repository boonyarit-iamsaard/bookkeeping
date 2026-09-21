import { formatMoney, formatMoneyParts } from "@bookkeeping/domain/money";
import type { components } from "@/core/api/openapi.gen";
import { TRANSACTION_TYPE_SIGNS } from "@/features/transactions/transaction-labels";
import { parseApiMoney } from "@/features/wallets/components/money";
import { cn } from "@/shared/helpers/cn";

interface SignedMoneyProps {
  transaction: Pick<components["schemas"]["Transaction"], "type" | "amount">;
  /** Display figures step the symbol and satang down so whole baht leads. */
  display?: boolean;
  className?: string;
}

/** "−฿120.00" for an expense, "+฿1,000.00" for income; the sign carries the type. */
export function SignedMoney({
  transaction,
  display = false,
  className,
}: Readonly<SignedMoneyProps>) {
  const sign = TRANSACTION_TYPE_SIGNS[transaction.type];
  const amountInMinorUnits = parseApiMoney(transaction.amount);
  const amount = {
    amountInMinorUnits,
    currency: transaction.amount.currency,
  };
  if (!display) {
    return (
      <span className={cn("money", className)} translate="no">
        {sign}
        {formatMoney(amount)}
      </span>
    );
  }
  const parts = formatMoneyParts(amount);
  return (
    <span className={cn("money", className)} translate="no">
      <span className="sr-only">
        {sign}
        {formatMoney(amount)}
      </span>
      <span aria-hidden="true">
        {sign}
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
