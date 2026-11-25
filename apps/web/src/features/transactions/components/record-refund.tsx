import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, notFound } from "@tanstack/react-router";
import { Wallet as WalletIcon } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { transactionQueries, walletQueries } from "@/core/api/queries";
import type { TransactionFormProps } from "@/features/transactions/hooks/use-transaction-entry-form";
import { linkedExpenseView } from "@/features/transactions/linked-expense";
import { toWalletOptions } from "@/features/transactions/wallet-options";
import { EmptyState } from "@/shared/components/empty-state";
import type { EntryDialogHost } from "@/shared/components/form/entry-dialog";
import { buttonVariants } from "@/shared/components/ui/button";

interface NoReceivingWalletProps {
  expenseId: string;
  originalWallet: components["schemas"]["TransactionWallet"];
  /** In the dialog the expense is already behind it, so ✕ is the way back. */
  hosted: boolean;
}

function NoReceivingWallet({
  expenseId,
  originalWallet,
  hosted,
}: Readonly<NoReceivingWalletProps>) {
  return (
    <EmptyState
      bare={hosted}
      icon={WalletIcon}
      headingId="no-wallet-heading"
      title="No active wallets"
      description={
        <>
          A refund lands in an active wallet.{" "}
          {originalWallet.archived
            ? `${originalWallet.name}, the expense’s wallet, is archived: unarchive it, or create another wallet, then record the refund.`
            : "Create a wallet or unarchive one, then record the refund."}
        </>
      }
      action={
        <>
          {originalWallet.archived && (
            <Link
              to="/wallets/$walletId/manage"
              params={{ walletId: originalWallet.id }}
              className={buttonVariants({ size: "lg" })}
            >
              Unarchive {originalWallet.name}
            </Link>
          )}
          <Link
            to="/wallets/new"
            className={buttonVariants({
              variant: originalWallet.archived ? "outline" : "default",
              size: "lg",
            })}
          >
            Create a wallet
          </Link>
          {!hosted && (
            <Link
              to="/transactions/$transactionId"
              params={{ transactionId: expenseId }}
              className={buttonVariants({ variant: "ghost", size: "lg" })}
            >
              Back to the expense
            </Link>
          )}
        </>
      }
    />
  );
}

interface RecordRefundProps {
  expenseId: string;
  host?: EntryDialogHost;
  /** The composition to record with; the route or dialog host picks it. */
  formComponent: React.ComponentType<TransactionFormProps>;
}

/** The refund form for an expense, or what to do first when no wallet can receive it. */
export function RecordRefund({
  expenseId,
  host,
  formComponent: Form,
}: Readonly<RecordRefundProps>) {
  const { data: expense } = useSuspenseQuery(
    transactionQueries.detail(expenseId),
  );
  const { data: refunds } = useSuspenseQuery(
    transactionQueries.refunds(expenseId),
  );
  const { data: walletCollection } = useSuspenseQuery(walletQueries.list());
  if (expense.type !== "expense") {
    throw notFound();
  }

  const wallets = toWalletOptions(walletCollection.items);
  const defaultWalletId =
    wallets.find((wallet) => wallet.id === expense.wallet.id)?.id ?? "";
  const linked = linkedExpenseView({ expense, refunds });

  return wallets.length > 0 ? (
    <Form
      wallets={wallets}
      mode={{ kind: "refund", expense: linked, defaultWalletId }}
      host={host}
    />
  ) : (
    <NoReceivingWallet
      expenseId={expense.id}
      originalWallet={expense.wallet}
      hosted={Boolean(host)}
    />
  );
}
