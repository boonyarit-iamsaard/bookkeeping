import type { TransactionType } from "@bookkeeping/domain/transactions";
import { DeleteTransactionButton } from "@/features/transactions/components/delete-transaction-button";
import { SaveLabel } from "@/features/transactions/components/transaction-form-fields";
import type {
  EditableTransaction,
  WalletOption,
} from "@/features/transactions/transaction.types";
import { EntrySaveBar } from "@/shared/components/form/entry-form";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/helpers/cn";

// The capture form's actions: Save, and for a correction, when it was recorded
// and how to delete it. Only the entry form compositions use them.

function walletNameOf(
  wallets: readonly WalletOption[],
  walletId: string | undefined,
) {
  return wallets.find((wallet) => wallet.id === walletId)?.name;
}

interface TransactionSaveButtonProps {
  wallets: readonly WalletOption[];
  pending: boolean;
  isSubmitting: boolean;
  type: TransactionType;
  amount: string;
  walletId: string;
  destinationWalletId: string | undefined;
  className?: string;
}

/** The submit button, reading back what Save will record. */
export function TransactionSaveButton({
  wallets,
  pending,
  isSubmitting,
  type,
  amount,
  walletId,
  destinationWalletId,
  className,
}: Readonly<TransactionSaveButtonProps>) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={
        pending ||
        isSubmitting ||
        (type === "transfer" && wallets.length < 2) ||
        (type === "refund" && !walletId)
      }
      className={cn(type === "transfer" && "h-auto", className)}
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
  );
}

/** Save, pinned to the bottom of a phone screen and inline from `sm` up. */
export function TransactionSaveBar(
  props: Readonly<Omit<TransactionSaveButtonProps, "className">>,
) {
  return (
    <EntrySaveBar>
      <TransactionSaveButton
        {...props}
        className={cn(
          "min-h-12 w-full text-base",
          props.type !== "transfer" && "h-12",
        )}
      />
    </EntrySaveBar>
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
    <footer className="flex flex-col gap-6 border-t pt-6 sm:order-last">
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
