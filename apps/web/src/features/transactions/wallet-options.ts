import { formatMoney } from "@bookkeeping/domain/money";
import type { components } from "@/core/api/openapi.gen";
import type { WalletOption } from "@/features/transactions/hooks/use-transaction-form";
import { parseApiMoney } from "@/features/wallets/components/money";

type ApiWallet = components["schemas"]["Wallet"];

/** The active wallets a new entry may pick, with their balances as labels. */
export function toWalletOptions(wallets: readonly ApiWallet[]): WalletOption[] {
  return wallets
    .filter((wallet) => wallet.archivedAt === null)
    .map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      type: wallet.type,
      openingDate: wallet.openingDate,
      balanceLabel: formatMoney({
        amountInMinorUnits: parseApiMoney(wallet.balance),
        currency: wallet.balance.currency,
      }),
    }));
}
