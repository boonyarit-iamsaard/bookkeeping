import type { TransactionType } from "@bookkeeping/domain/transactions";
import { DeleteTransactionButton } from "@/features/transactions/components/delete-transaction-button";
import { SaveLabel } from "@/features/transactions/components/transaction-form-fields";
import type {
  EditableTransaction,
  WalletOption,
} from "@/features/transactions/transaction.types";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/helpers/cn";

// The capture form's actions: Save, and for a correction, when it was recorded
// and how to delete it. Only `TransactionForm` composes them.

function walletNameOf(
  wallets: readonly WalletOption[],
  walletId: string | undefined,
) {
  return wallets.find((wallet) => wallet.id === walletId)?.name;
}

interface TransactionSaveBarProps {
  wallets: readonly WalletOption[];
  pending: boolean;
  isSubmitting: boolean;
  type: TransactionType;
  amount: string;
  walletId: string;
  destinationWalletId: string | undefined;
}

/** Save, pinned to the bottom of a phone screen and inline from `sm` up. */
export function TransactionSaveBar({
  wallets,
  pending,
  isSubmitting,
  type,
  amount,
  walletId,
  destinationWalletId,
}: Readonly<TransactionSaveBarProps>) {
  return (
    <div className="border-border bg-chrome/95 supports-backdrop-filter:bg-chrome/85 fixed inset-x-0 bottom-0 z-20 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 sm:max-w-none">
        <Button
          type="submit"
          size="lg"
          disabled={
            pending ||
            isSubmitting ||
            (type === "transfer" && wallets.length < 2) ||
            (type === "refund" && !walletId)
          }
          className={cn(
            "min-h-12 w-full text-base",
            type === "transfer" ? "h-auto" : "h-12",
          )}
        >
          {isSubmitting || pending ? (
            "Saving…"
          ) : (
            <SaveLabel
              type={type}
              amountText={amount}
              walletName={walletNameOf(wallets, walletId)}
              destinationWalletName={walletNameOf(wallets, destinationWalletId)}
            />
          )}
        </Button>
      </div>
    </div>
  );
}

interface TransactionEditFooterProps {
  transaction: EditableTransaction;
  wallets: readonly WalletOption[];
  pending: boolean;
}

export function TransactionEditFooter({
  transaction,
  wallets,
  pending,
}: Readonly<TransactionEditFooterProps>) {
  return (
    <footer className="flex flex-col gap-6 border-t pt-6">
      <p className="text-muted-foreground text-sm leading-normal">
        Recorded {transaction.recordedLabel} Bangkok time. Editing keeps this
        original recording time.
      </p>
      {transaction.refundedLabel && (
        <p className="text-muted-foreground text-sm leading-normal">
          <span className="money" translate="no">
            {transaction.refundedLabel}
          </span>{" "}
          of this expense has been refunded. The amount cannot go below that,
          the date cannot pass the earliest refund, and the expense cannot be
          deleted until its refunds are.
        </p>
      )}
      <DeleteTransactionButton
        transaction={transaction}
        walletName={walletNameOf(wallets, transaction.walletId)}
        destinationWalletName={walletNameOf(
          wallets,
          transaction.destinationWalletId,
        )}
        disabled={pending}
      />
    </footer>
  );
}
