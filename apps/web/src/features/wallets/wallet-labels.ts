import type { WalletType } from "@bookkeeping/domain/wallets";

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  cash: "Cash",
  bank_account: "Bank account",
  e_wallet: "E-wallet",
};

/** "1 wallet", "3 wallets": what a total covers. */
export function walletCountLabel(count: number): string {
  return count === 1 ? "1 wallet" : `${count} wallets`;
}
