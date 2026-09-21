import type { WalletType } from "@bookkeeping/domain/wallets";
import type { LucideProps } from "lucide-react";
import { Banknote, Landmark, Smartphone } from "lucide-react";

const ICONS: Record<WalletType, React.ComponentType<LucideProps>> = {
  cash: Banknote,
  bank_account: Landmark,
  e_wallet: Smartphone,
};

interface WalletTypeIconProps extends LucideProps {
  type: WalletType;
}

/** Decorative: the type is always named in text beside it. */
export function WalletTypeIcon({
  type,
  ...props
}: Readonly<WalletTypeIconProps>) {
  const Icon = ICONS[type];
  return <Icon aria-hidden="true" strokeWidth={1.75} {...props} />;
}
