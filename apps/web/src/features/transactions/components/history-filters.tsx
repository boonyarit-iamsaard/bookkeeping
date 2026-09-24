import { Dialog } from "@base-ui/react/dialog";
import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { TRANSACTION_TYPES } from "@bookkeeping/domain/transactions";
import { Link, useNavigate } from "@tanstack/react-router";
import { SlidersHorizontal, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import type { components } from "@/core/api/openapi.gen";
import type { FilterOptionGroup } from "@/features/transactions/components/filter-select";
import { FilterSelect } from "@/features/transactions/components/filter-select";
import { historyFilterChips } from "@/features/transactions/history-chips";
import type { HistorySearch } from "@/features/transactions/history-schema";
import {
  HISTORY_FILTER_KEYS,
  parseHistoryFilters,
} from "@/features/transactions/history-schema";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { DatePicker } from "@/shared/components/date-picker";
import { Button } from "@/shared/components/ui/button";
import { SheetPortal } from "@/shared/components/ui/sheet";

type ApiWallet = components["schemas"]["Wallet"];
type ApiCategory = components["schemas"]["Category"];

interface HistoryFilterChipsProps {
  wallets: readonly ApiWallet[];
  categories: readonly ApiCategory[];
  values: Readonly<HistorySearch>;
}

interface HistoryFiltersProps extends HistoryFilterChipsProps {}

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

/**
 * Filter in the title bar: a sheet holding the history's GET controls. The
 * address stays the source of truth, so an invalid value reopens as typed.
 */
export function HistoryFilters({
  wallets,
  categories,
  values,
}: Readonly<HistoryFiltersProps>) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  function value(key: (typeof HISTORY_FILTER_KEYS)[number]) {
    return values[key] ?? "";
  }
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  const parsed = parseHistoryFilters(values);
  const errors = parsed.ok ? [] : parsed.errors;

  function showFilters(search: HistorySearch) {
    setOpen(false);
    void navigate({ to: "/transactions", search });
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    showFilters(filtersFromForm(event.currentTarget));
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger render={<Button variant="outline" size="lg" />}>
        <SlidersHorizontal data-icon="inline-start" />
        Filter
      </Dialog.Trigger>
      <SheetPortal>
        <Dialog.Title className="shrink-0 px-4 pt-4 pb-2 font-semibold text-lg sm:px-6 sm:pt-6">
          Filter transactions
        </Dialog.Title>
        <form
          key={JSON.stringify(values)}
          onSubmit={applyFilters}
          aria-label="History filters"
          className="flex min-h-0 flex-col"
        >
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-2 sm:px-6">
            {errors.length > 0 && (
              <div role="alert" className="text-destructive text-sm">
                {errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}
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
                  keepMalformed
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
                  keepMalformed
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
            <p className="text-muted-foreground text-sm">
              Dates are inclusive. A parent category includes its children; a
              wallet includes transfers in either direction.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3 px-4 py-4 sm:px-6 sm:pb-6">
            <Button type="submit" variant="outline" size="lg">
              Apply filters
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => showFilters({})}
            >
              Clear filters
            </Button>
          </div>
        </form>
      </SheetPortal>
    </Dialog.Root>
  );
}

/** The active filters under the title; each chip lifts just its own filter. */
export function HistoryFilterChips({
  wallets,
  categories,
  values,
}: Readonly<HistoryFilterChipsProps>) {
  const chips = historyFilterChips(values, { wallets, categories });
  if (chips.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Active filters" className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            to="/transactions"
            search={chip.without}
            // `without` is a subset of the current search, so the default
            // match would mark every chip as the current page.
            activeOptions={{ exact: true, includeSearch: true }}
            aria-label={`Remove filter ${chip.label}`}
            className="flex min-h-9 max-w-full items-center gap-1 rounded-full border px-3 text-sm outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="truncate">{chip.label}</span>
            <X
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-4 shrink-0"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
