import Form from "next/form";
import Link from "next/link";
import type { CategorySummary } from "@/features/categories/category.types";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPES,
} from "@/features/transactions/transaction.types";
import type { WalletSummary } from "@/features/wallets/wallet.types";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

interface HistoryFiltersProps {
  wallets: readonly WalletSummary[];
  categories: readonly CategorySummary[];
  values: Readonly<Record<string, string | string[] | undefined>>;
}

const selectClassName =
  "h-11 w-full min-w-0 rounded-4xl border border-input bg-input/30 px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm";

export function HistoryFilters({
  wallets,
  categories,
  values,
}: Readonly<HistoryFiltersProps>) {
  function value(key: string) {
    return typeof values[key] === "string" ? values[key] : "";
  }
  const active = ["from", "to", "walletId", "categoryId", "type"].some((key) =>
    Boolean(values[key]),
  );
  return (
    <details open={active} className="border-y py-5">
      <summary className="min-h-11 cursor-pointer rounded-sm py-3 font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        Filter history{active ? " · Active filters" : ""}
      </summary>
      <Form
        key={JSON.stringify(values)}
        action="/transactions"
        aria-label="History filters"
        className="flex flex-col gap-4 pt-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label
            htmlFor="history-from"
            className="flex min-w-0 flex-col gap-2 font-medium text-sm"
          >
            From date
            <Input
              id="history-from"
              name="from"
              type="date"
              defaultValue={value("from")}
              className="h-11"
            />
          </label>
          <label
            htmlFor="history-to"
            className="flex min-w-0 flex-col gap-2 font-medium text-sm"
          >
            To date
            <Input
              id="history-to"
              name="to"
              type="date"
              defaultValue={value("to")}
              className="h-11"
            />
          </label>
          <div className="flex min-w-0 flex-col gap-2 font-medium text-sm">
            <label htmlFor="history-walletId">Filter wallet</label>
            <select
              id="history-walletId"
              name="walletId"
              defaultValue={value("walletId")}
              className={selectClassName}
            >
              <option value="">All wallets</option>
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name}
                  {wallet.archivedAt ? " (Archived)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-2 font-medium text-sm">
            <label htmlFor="history-categoryId">Filter category</label>
            <select
              id="history-categoryId"
              name="categoryId"
              defaultValue={value("categoryId")}
              className={selectClassName}
            >
              <option value="">All categories</option>
              {categories.map((category) => {
                const parent = categories.find(
                  (candidate) => candidate.id === category.parentId,
                );
                return (
                  <option key={category.id} value={category.id}>
                    {category.kind === "expense" ? "Expense" : "Income"} ·{" "}
                    {parent ? `${parent.name} › ` : ""}
                    {category.name}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-2 font-medium text-sm">
            <label htmlFor="history-type">Type</label>
            <select
              id="history-type"
              name="type"
              defaultValue={value("type")}
              className={selectClassName}
            >
              <option value="">All types</option>
              {TRANSACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TRANSACTION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="outline" size="lg">
            Apply filters
          </Button>
          <Link
            href="/transactions"
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            Clear filters
          </Link>
        </div>
        <p className="text-muted-foreground text-sm">
          Dates are inclusive. A parent category includes its children; a wallet
          includes transfers in either direction.
        </p>
      </Form>
    </details>
  );
}
