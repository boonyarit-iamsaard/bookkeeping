import type { LucideIcon } from "lucide-react";
import { ChartPie, House, ReceiptText, Wallet } from "lucide-react";

interface Destination {
  to: "/" | "/transactions" | "/wallets" | "/dashboard";
  label: string;
  icon: LucideIcon;
}

/** The four places the tab bar and the desktop header both lead to. */
export const DESTINATIONS = [
  { to: "/", label: "Home", icon: House },
  { to: "/transactions", label: "Transactions", icon: ReceiptText },
  { to: "/wallets", label: "Wallets", icon: Wallet },
  // The report keeps its /dashboard address until the Reports rename.
  { to: "/dashboard", label: "Reports", icon: ChartPie },
] as const satisfies readonly Destination[];
