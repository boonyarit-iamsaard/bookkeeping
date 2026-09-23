import { formatMoneyInput } from "@bookkeeping/domain/money";
import type { ApiMoney } from "@/core/api/money";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";

type WalletSummary = components["schemas"]["Wallet"];

/** The balance across the given wallets, archived ones included, in THB. */
export function totalWalletBalance(
  wallets: readonly WalletSummary[],
): ApiMoney {
  const amountInMinorUnits = wallets.reduce(
    (total, wallet) => total + parseApiMoney(wallet.balance),
    0n,
  );
  return {
    value: formatMoneyInput({ amountInMinorUnits, currency: "THB" }),
    currency: "THB",
  };
}
