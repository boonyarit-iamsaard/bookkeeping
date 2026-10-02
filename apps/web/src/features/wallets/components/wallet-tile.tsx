import type { WalletType } from "@bookkeeping/domain/wallets";
import { WalletTypeIcon } from "@/features/wallets/components/wallet-type-icon";
import { cn } from "@/shared/helpers/cn";

interface WalletTileProps {
  type: WalletType;
  /** An archived wallet's tile goes quiet; its caption says Archived. */
  archived: boolean;
}

/** A wallet's leading 44px tile: its type's pictogram on Iris Tonal. */
export function WalletTile({ type, archived }: Readonly<WalletTileProps>) {
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-lg",
        archived
          ? "bg-muted text-muted-foreground"
          : "bg-secondary text-secondary-foreground",
      )}
    >
      <WalletTypeIcon type={type} className="size-5" />
    </span>
  );
}
