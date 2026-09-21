// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import type { components } from "@/core/api/openapi.gen";
import { ApiProblemError } from "@/core/api/problem";
import {
  categoryQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";
import { HistoryLoading } from "@/features/transactions/components/history-loading";
import { TransactionForm } from "@/features/transactions/components/transaction-form";
import { editableTransaction } from "@/features/transactions/editable-transaction";
import type {
  CategoryOption,
  WalletOption,
} from "@/features/transactions/hooks/use-transaction-form";
import { linkedExpenseView } from "@/features/transactions/linked-expense";
import type { LinkedExpenseView } from "@/features/transactions/transaction.types";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { toWalletOptions } from "@/features/transactions/wallet-options";
import { buttonVariants } from "@/shared/components/ui/button";

const NOT_FOUND_STATUS = 404;

type Transaction = components["schemas"]["Transaction"];

export const Route = createFileRoute("/_app/transactions/$transactionId_/edit")(
  {
    head: () => ({ meta: [{ title: "Edit transaction" }] }),
    loader: async ({ context, params }) => {
      let transaction: Transaction | undefined;
      try {
        transaction = await context.queryClient.ensureQueryData(
          transactionQueries.detail(params.transactionId),
        );
      } catch (error) {
        // Ownership is part of the lookup: another user's id reads as not
        // found, and so does a deleted transaction.
        if (
          error instanceof ApiProblemError &&
          error.problem.status === NOT_FOUND_STATUS
        ) {
          throw notFound();
        }
        throw error;
      }
      if (!transaction) {
        throw new Error("The transaction query returned no data");
      }

      // A refund shows its expense; an expense shows what it has refunded.
      const refundedExpenseId = transaction.refundOf?.id ?? transaction.id;
      await Promise.all([
        context.queryClient.ensureQueryData(walletQueries.list()),
        context.queryClient.ensureQueryData(categoryQueries.list()),
        transaction.refundOf
          ? context.queryClient.ensureQueryData(
              transactionQueries.detail(refundedExpenseId),
            )
          : undefined,
        transaction.type === "expense" || transaction.refundOf
          ? context.queryClient.ensureQueryData(
              transactionQueries.refunds(refundedExpenseId),
            )
          : undefined,
      ]);
    },
    pendingComponent: HistoryLoading,
    errorComponent: HistoryErrorBoundary,
    component: EditTransactionPage,
  },
);

function EditTransactionPage() {
  const { transactionId } = Route.useParams();
  const { data: transaction } = useSuspenseQuery(
    transactionQueries.detail(transactionId),
  );
  const { data: walletCollection } = useSuspenseQuery(walletQueries.list());
  const { data: categoryCollection } = useSuspenseQuery(categoryQueries.list());
  if (!transaction || !walletCollection || !categoryCollection) {
    throw new Error("The transaction edit queries returned no data");
  }

  const wallets = toWalletOptions(walletCollection.items, {
    retainedWalletIds: [
      transaction.wallet.id,
      ...(transaction.destinationWallet
        ? [transaction.destinationWallet.id]
        : []),
    ],
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pt-8 pb-40 sm:pb-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl tracking-tight">
          Edit {TRANSACTION_TYPE_LABELS[transaction.type].toLowerCase()}
        </h1>
        <Link
          to="/transactions/$transactionId"
          params={{ transactionId: transaction.id }}
          className={buttonVariants({
            variant: "ghost",
            className: "max-sm:hidden",
          })}
        >
          Cancel
        </Link>
      </div>
      <EditTransactionForm
        transaction={transaction}
        wallets={wallets}
        categories={categoryCollection.items}
      />
    </main>
  );
}

interface EditTransactionFormProps {
  transaction: Transaction;
  wallets: readonly WalletOption[];
  categories: readonly CategoryOption[];
}

/** A refund shows its expense; an expense shows what it has refunded. */
function EditTransactionForm(props: Readonly<EditTransactionFormProps>) {
  if (props.transaction.refundOf) {
    return (
      <EditRefundForm {...props} expenseId={props.transaction.refundOf.id} />
    );
  }
  if (props.transaction.type === "expense") {
    return <EditExpenseForm {...props} />;
  }
  return <EditForm {...props} />;
}

interface EditRefundFormProps extends EditTransactionFormProps {
  expenseId: string;
}

function EditRefundForm({
  expenseId,
  ...props
}: Readonly<EditRefundFormProps>) {
  const { data: expense } = useSuspenseQuery(
    transactionQueries.detail(expenseId),
  );
  const { data: refunds } = useSuspenseQuery(
    transactionQueries.refunds(expenseId),
  );
  if (!expense || !refunds) {
    throw new Error("The refunded expense queries returned no data");
  }
  return (
    <EditForm
      {...props}
      refundOf={linkedExpenseView({
        expense,
        refunds,
        editingRefund: props.transaction,
      })}
    />
  );
}

function EditExpenseForm(props: Readonly<EditTransactionFormProps>) {
  const { data: refunds } = useSuspenseQuery(
    transactionQueries.refunds(props.transaction.id),
  );
  if (!refunds) {
    throw new Error("The expense refunds query returned no data");
  }
  return <EditForm {...props} refunds={refunds} />;
}

interface EditFormProps extends EditTransactionFormProps {
  refundOf?: LinkedExpenseView;
  refunds?: components["schemas"]["TransactionRefunds"];
}

function EditForm({
  transaction,
  wallets,
  categories,
  refundOf,
  refunds,
}: Readonly<EditFormProps>) {
  return (
    <TransactionForm
      wallets={wallets}
      categories={categories}
      today={todayIn({ timeZone: APP_TIME_ZONE })}
      mode={{
        kind: "edit",
        transaction: editableTransaction({ transaction, refundOf, refunds }),
      }}
    />
  );
}
