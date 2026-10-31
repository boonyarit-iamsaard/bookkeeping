import type { WalletType } from "@bookkeeping/domain/wallets";
import type { components } from "@/core/api/openapi.gen";

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  cash: "Cash",
  bank_account: "Bank account",
  e_wallet: "E-wallet",
};

/** "1 wallet", "3 wallets": what a total covers. */
export function walletCountLabel(count: number): string {
  return count === 1 ? "1 wallet" : `${count} wallets`;
}

type Wallet = components["schemas"]["Wallet"];

/** The morph name a wallet's card shares with its page's hero card. */
export function walletMorphName(walletId: string): string {
  return `wallet-${walletId}`;
}

/** "Cash", "Cash · Archived": a wallet's caption on the list and its page. */
export function walletCaption({
  type,
  archivedAt,
}: Readonly<Pick<Wallet, "type" | "archivedAt">>): string {
  return archivedAt
    ? `${WALLET_TYPE_LABELS[type]} · Archived`
    : WALLET_TYPE_LABELS[type];
}
