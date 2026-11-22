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

/** How a wallet's balance counts: Spendable, or Set aside when it is Savings. */
export function walletHeldAsLabel({
  savings,
}: Readonly<Pick<Wallet, "savings">>): string {
  return savings ? "Set aside" : "Spendable";
}

/** A wallet's type, then Savings and Archived markers when applicable. */
export function walletCaption({
  type,
  savings,
  archivedAt,
}: Readonly<Pick<Wallet, "type" | "savings" | "archivedAt">>): string {
  return `${WALLET_TYPE_LABELS[type]}${savings ? " · Savings" : ""}${archivedAt ? " · Archived" : ""}`;
}
