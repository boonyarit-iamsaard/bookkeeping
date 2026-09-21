import { formatMoney } from "@bookkeeping/domain/money";
import type { components } from "@/core/api/openapi.gen";
import type { WalletOption } from "@/features/transactions/hooks/use-transaction-form";
import { parseApiMoney } from "@/features/wallets/components/money";

type ApiWallet = components["schemas"]["Wallet"];

interface WalletOptionsOptions {
  /**
   * Retained wallets: archived wallets the transaction being corrected
   * already points at, which stay selectable on edit only.
   */
  retainedWalletIds?: readonly string[];
}

/** The wallets an entry may pick, with their balances as labels. */
export function toWalletOptions(
  wallets: readonly ApiWallet[],
  { retainedWalletIds = [] }: Readonly<WalletOptionsOptions> = {},
): WalletOption[] {
  return wallets
    .filter(
      (wallet) =>
        wallet.archivedAt === null || retainedWalletIds.includes(wallet.id),
    )
    .map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      type: wallet.type,
      openingDate: wallet.openingDate,
      archived: wallet.archivedAt !== null,
      balanceLabel: formatMoney({
        amountInMinorUnits: parseApiMoney(wallet.balance),
        currency: wallet.balance.currency,
      }),
    }));
}
