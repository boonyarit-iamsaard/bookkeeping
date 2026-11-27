import type { TransactionType } from "@bookkeeping/domain/transactions";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Undo2,
} from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { categoryLabel } from "@/features/categories/category-search";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { tableRowLinkClass } from "@/shared/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/helpers/cn";

type ApiTransaction = components["schemas"]["Transaction"];
type ApiTransactionWallet = components["schemas"]["TransactionWallet"];

/** Home's income and expense arrows, the phone list's transfer. */
const TYPE_ICONS: Record<TransactionType, LucideIcon> = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowRightLeft,
  refund: Undo2,
};

/**
 * A row's type as a muted icon, named by its tooltip and to assistive
 * technology. It sits above the row's stretched link and overhangs its line,
 * so it never heightens the row.
 */
export function TransactionTypeIcon({
  type,
}: Readonly<{ type: TransactionType }>) {
  const Icon = TYPE_ICONS[type];
  const label = TRANSACTION_TYPE_LABELS[type];
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        className="text-muted-foreground focus-visible:ring-ring/45 relative z-1 -my-1 flex size-6 items-center justify-center rounded-md outline-none focus-visible:ring-[3px]"
      >
        <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

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
  const category = transaction.category;
  const path = category && categoryLabel(category);
  return (
    <>
      <Link
        to="/transactions/$transactionId"
        params={{ transactionId: transaction.id }}
        // The full path names the link. No title: it showed over the whole row.
        aria-label={path || undefined}
        // One line in the width its column gives it; the link is unpositioned,
        // so its stretched ::after is not clipped.
        className={cn(
          category?.parentName ? "flex min-w-0" : "block truncate",
          tableRowLinkClass,
        )}
      >
        {category?.parentName ? (
          <>
            {/* The quieter parent gives way first, so the leaf stays whole. */}
            <span className="text-muted-foreground min-w-0 shrink-[100] truncate font-normal">
              {category.parentName}
            </span>
            <span className="text-muted-foreground shrink-0 px-1 font-normal">
              ›
            </span>
            <span className="min-w-0 truncate">{category.name}</span>
          </>
        ) : (
          (category?.name ?? TRANSACTION_TYPE_LABELS[transaction.type])
        )}
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
