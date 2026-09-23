import type { LucideIcon } from "lucide-react";
import { ChartPie, House, ReceiptText, Wallet } from "lucide-react";

export interface Destination {
  to: "/" | "/transactions" | "/wallets" | "/reports";
  label: string;
  icon: LucideIcon;
}

/** The four places the tab bar and the desktop header both lead to. */
export const DESTINATIONS = [
  { to: "/", label: "Home", icon: House },
  { to: "/transactions", label: "Transactions", icon: ReceiptText },
  { to: "/wallets", label: "Wallets", icon: Wallet },
  { to: "/reports", label: "Reports", icon: ChartPie },
] as const satisfies readonly Destination[];
