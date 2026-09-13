import type { WalletType } from "@/core/database/schema/wallet-type";

export type { WalletType } from "@/core/database/schema/wallet-type";
export { WALLET_TYPES } from "@/core/database/schema/wallet-type";

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  cash: "Cash",
  bank_account: "Bank account",
  e_wallet: "E-wallet",
};
