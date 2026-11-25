import { Link } from "@tanstack/react-router";
import { ArrowRightLeft } from "lucide-react";
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
  return (
    <>
      <Link
        to="/transactions/$transactionId"
        params={{ transactionId: transaction.id }}
        className={cn("inline-flex items-center gap-1.5", tableRowLinkClass)}
      >
        {transfer && (
          <ArrowRightLeft
            aria-hidden="true"
            strokeWidth={1.75}
            className="text-muted-foreground size-4 shrink-0"
          />
        )}
        {transaction.category
          ? categoryLabel(transaction.category)
          : TRANSACTION_TYPE_LABELS[transaction.type]}
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
