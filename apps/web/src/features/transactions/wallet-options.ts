import { formatMoney } from "@bookkeeping/domain/money";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import type { WalletOption } from "@/features/transactions/hooks/use-transaction-form";

type ApiWallet = components["schemas"]["Wallet"];

interface WalletOptionsOptions {
  /**
   * Retained wallets: archived wallets the transaction being corrected
   * already points at, which stay selectable on edit only.
   */
  retainedWalletIds?: readonly string[];
}

interface DefaultWalletOptions {
  requestedWalletId?: string;
  lastUsedWalletId?: string | null;
  activeWallets: readonly Pick<WalletOption, "id">[];
}

/** Chooses the requested, last-used, then first active wallet for a new entry. */
export function resolveDefaultWalletId({
  requestedWalletId,
  lastUsedWalletId,
  activeWallets,
}: Readonly<DefaultWalletOptions>): string | undefined {
  const activeIds = new Set(activeWallets.map((wallet) => wallet.id));
  if (requestedWalletId && activeIds.has(requestedWalletId)) {
    return requestedWalletId;
  }
  if (lastUsedWalletId && activeIds.has(lastUsedWalletId)) {
    return lastUsedWalletId;
  }
  return activeWallets[0]?.id;
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
