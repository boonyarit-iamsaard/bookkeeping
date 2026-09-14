import Form from "next/form";
import Link from "next/link";
import type { CategorySummary } from "@/features/categories/category.types";
import type { FilterOptionGroup } from "@/features/transactions/components/filter-select";
import { FilterSelect } from "@/features/transactions/components/filter-select";
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

/** Each tree as a group: parents first, their children indented beneath. */
function categoryGroups(
  categories: readonly CategorySummary[],
): FilterOptionGroup[] {
  return (["expense", "income"] as const).flatMap((kind) => {
    const parents = categories.filter(
      (category) => category.kind === kind && category.parentId === null,
    );
    const options = parents.flatMap((parent) => [
      { value: parent.id, label: parent.name },
      ...categories
        .filter((category) => category.parentId === parent.id)
        .map((child) => ({ value: child.id, label: child.name, indent: true })),
    ]);
    return options.length > 0
      ? [{ label: kind === "expense" ? "Expense" : "Income", options }]
      : [];
  });
}

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
            <FilterSelect
              id="history-walletId"
              name="walletId"
              defaultValue={value("walletId")}
              allLabel="All wallets"
              groups={[
                {
                  options: wallets.map((wallet) => ({
                    value: wallet.id,
                    label: wallet.name,
                    hint: wallet.archivedAt ? "Archived" : undefined,
                  })),
                },
              ]}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2 font-medium text-sm">
            <label htmlFor="history-categoryId">Filter category</label>
            <FilterSelect
              id="history-categoryId"
              name="categoryId"
              defaultValue={value("categoryId")}
              allLabel="All categories"
              groups={categoryGroups(categories)}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2 font-medium text-sm">
            <label htmlFor="history-type">Type</label>
            <FilterSelect
              id="history-type"
              name="type"
              defaultValue={value("type")}
              allLabel="All types"
              groups={[
                {
                  options: TRANSACTION_TYPES.map((type) => ({
                    value: type,
                    label: TRANSACTION_TYPE_LABELS[type],
                  })),
                },
              ]}
            />
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
