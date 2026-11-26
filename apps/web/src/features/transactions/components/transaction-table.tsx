import { Link } from "@tanstack/react-router";
import type { components } from "@/core/api/openapi.gen";
import { categoryLabel } from "@/features/categories/category-search";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { tableRowLinkClass } from "@/shared/components/ui/table";
import { cn } from "@/shared/helpers/cn";

type ApiTransaction = components["schemas"]["Transaction"];
type ApiTransactionWallet = components["schemas"]["TransactionWallet"];

export function walletName(wallet: ApiTransactionWallet) {
  return wallet.archived ? `${wallet.name} (Archived)` : wallet.name;
}

interface TransactionCategoryCellProps {
  transaction: Readonly<ApiTransaction>;
  /** A transfer's wallets, as `transferWallets` names them; null otherwise. */
  transfer: string | null;
  /** Names the transfer's wallets under it, where no Wallet column does. */
  showTransfer: boolean;
}

/** The row's link: the category, or the type for a transfer, with its caption. */
export function TransactionCategoryCell({
  transaction,
  transfer,
  showTransfer,
}: Readonly<TransactionCategoryCellProps>) {
  const path = transaction.category && categoryLabel(transaction.category);
  return (
    <>
      <Link
        to="/transactions/$transactionId"
        params={{ transactionId: transaction.id }}
        // The full path names the link and shows on hover; the cell shows only
        // the subcategory, so a nested path leaves room for the other columns.
        aria-label={path || undefined}
        title={path || undefined}
        // One line in the width its column gives it; the link is unpositioned,
        // so its stretched ::after is not clipped.
        className={cn("block truncate", tableRowLinkClass)}
      >
        {transaction.category?.name ??
          TRANSACTION_TYPE_LABELS[transaction.type]}
      </Link>
      {/* Captions are text, not links: the row is the link. */}
      {transaction.type === "refund" && transaction.category && (
        <span className="text-muted-foreground block text-xs font-normal">
          Refund
        </span>
      )}
      {showTransfer && transfer && (
        <span className="text-muted-foreground block text-xs font-normal">
          {transfer}
        </span>
      )}
    </>
  );
}
