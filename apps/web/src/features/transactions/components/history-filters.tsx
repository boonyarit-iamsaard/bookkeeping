import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { TRANSACTION_TYPES } from "@bookkeeping/domain/transactions";
import { Link, useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import type { components } from "@/core/api/openapi.gen";
import type { FilterOptionGroup } from "@/features/transactions/components/filter-select";
import { FilterSelect } from "@/features/transactions/components/filter-select";
import type { HistorySearch } from "@/features/transactions/history-schema";
import {
  HISTORY_FILTER_KEYS,
  hasHistoryFilters,
} from "@/features/transactions/history-schema";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { DatePicker } from "@/shared/components/date-picker";
import { Button, buttonVariants } from "@/shared/components/ui/button";

type ApiWallet = components["schemas"]["Wallet"];
type ApiCategory = components["schemas"]["Category"];

interface HistoryFiltersProps {
  wallets: readonly ApiWallet[];
  categories: readonly ApiCategory[];
  values: Readonly<HistorySearch>;
}

/** Each tree as a group: parents first, their children indented beneath. */
function categoryGroups(
  categories: readonly ApiCategory[],
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

/** The controls' values as the GET form would have sent them; empty ones lift the filter. */
function filtersFromForm(form: HTMLFormElement): HistorySearch {
  const data = new FormData(form);
  return Object.fromEntries(
    HISTORY_FILTER_KEYS.flatMap((key) => {
      const value = data.get(key);
      return typeof value === "string" && value !== "" ? [[key, value]] : [];
    }),
  );
}

export function HistoryFilters({
  wallets,
  categories,
  values,
}: Readonly<HistoryFiltersProps>) {
  const navigate = useNavigate();
  function value(key: (typeof HISTORY_FILTER_KEYS)[number]) {
    return values[key] ?? "";
  }
  const active = hasHistoryFilters(values);
  const today = todayIn({ timeZone: APP_TIME_ZONE });

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void navigate({
      to: "/transactions",
      search: filtersFromForm(event.currentTarget),
    });
  }

  return (
    <details open={active} className="border-y py-5">
      <summary className="min-h-11 cursor-pointer rounded-sm py-3 font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        Filter history{active ? " · Active filters" : ""}
      </summary>
      <form
        key={JSON.stringify(values)}
        onSubmit={applyFilters}
        aria-label="History filters"
        className="flex flex-col gap-4 pt-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2 font-medium text-sm">
            <label htmlFor="history-from">From date</label>
            <DatePicker
              id="history-from"
              name="from"
              today={today}
              max={today}
              defaultValue={value("from")}
              placeholder="Any date"
              clearable
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2 font-medium text-sm">
            <label htmlFor="history-to">To date</label>
            <DatePicker
              id="history-to"
              name="to"
              today={today}
              max={today}
              defaultValue={value("to")}
              placeholder="Any date"
              clearable
            />
          </div>
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
            to="/transactions"
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            Clear filters
          </Link>
        </div>
        <p className="text-muted-foreground text-sm">
          Dates are inclusive. A parent category includes its children; a wallet
          includes transfers in either direction.
        </p>
      </form>
    </details>
  );
}
