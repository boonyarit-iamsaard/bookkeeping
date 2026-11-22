import type { LucideIcon } from "lucide-react";
import {
  ChartPie,
  FolderTree,
  Hash,
  House,
  ReceiptText,
  Wallet,
} from "lucide-react";

export interface Destination {
  to: "/" | "/transactions" | "/wallets" | "/reports" | "/categories" | "/tags";
  label: string;
  icon: LucideIcon;
}

/** The four places the tab bar and the desktop sidebar both lead to. */
export const DESTINATIONS = [
  { to: "/", label: "Home", icon: House },
  { to: "/transactions", label: "Transactions", icon: ReceiptText },
  { to: "/wallets", label: "Wallets", icon: Wallet },
  { to: "/reports", label: "Reports", icon: ChartPie },
] as const satisfies readonly Destination[];

/**
 * Set up rarely, so the desktop sidebar keeps them apart from the daily
 * places; on phone the account sheet reaches them.
 */
export const MANAGEMENT_DESTINATIONS = [
  { to: "/categories", label: "Categories", icon: FolderTree },
  { to: "/tags", label: "Tags", icon: Hash },
] as const satisfies readonly Destination[];
