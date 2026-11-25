import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Wallet as WalletIcon } from "lucide-react";
import { transactionQueries, walletQueries } from "@/core/api/queries";
import type { CaptureOrigin } from "@/features/transactions/capture-origin";
import type { TransactionFormProps } from "@/features/transactions/hooks/use-transaction-entry-form";
import {
  resolveDefaultWalletId,
  toWalletOptions,
} from "@/features/transactions/wallet-options";
import { EmptyState } from "@/shared/components/empty-state";
import type { EntryDialogHost } from "@/shared/components/form/entry-dialog";
import { buttonVariants } from "@/shared/components/ui/button";

function NoWallet() {
  return (
    <EmptyState
      icon={WalletIcon}
      headingId="no-wallet-heading"
      title="No active wallets"
      description="Every transaction belongs to a wallet. Add the cash, bank account, or e-wallet the money moved through, then come back to record it."
      action={
        <>
          <Link
            to="/wallets"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Create or unarchive a wallet
          </Link>
          <Link to="/wallets/new" className={buttonVariants({ size: "lg" })}>
            Create a wallet
          </Link>
        </>
      }
    />
  );
}

interface RecordTransactionProps {
  captureOrigin: CaptureOrigin;
  requestedWalletId?: string;
  host?: EntryDialogHost;
  /** The composition to record with; the route or dialog host picks it. */
  formComponent: React.ComponentType<TransactionFormProps>;
}

/** The new-transaction form, or what to do first when no wallet is active. */
export function RecordTransaction({
  captureOrigin,
  requestedWalletId,
  host,
  formComponent: Form,
}: Readonly<RecordTransactionProps>) {
  const { data: walletCollection } = useSuspenseQuery(walletQueries.list());
  const { data: entryDefaults } = useSuspenseQuery(
    transactionQueries.entryDefaults(),
  );
  const wallets = toWalletOptions(walletCollection.items);
  const defaultWalletId = resolveDefaultWalletId({
    requestedWalletId,
    lastUsedWalletId: entryDefaults.lastUsedWalletId,
    activeWallets: wallets,
  });

  return defaultWalletId ? (
    <Form
      wallets={wallets}
      mode={{ kind: "record", defaultWalletId, captureOrigin }}
      host={host}
    />
  ) : (
    <NoWallet />
  );
}
