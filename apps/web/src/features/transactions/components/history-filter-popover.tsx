import { TRANSACTION_TYPES } from "@bookkeeping/domain/transactions";
import { ListFilter } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { FilterSelect } from "@/features/transactions/components/filter-select";
import {
  categoryGroups,
  TagFilter,
} from "@/features/transactions/components/history-filters";
import {
  changeHistoryFilter,
  toggleHistoryTag,
} from "@/features/transactions/history-filter-change";
import type {
  HistoryFilterKey,
  HistoryFilterValues,
} from "@/features/transactions/history-schema";
import { HISTORY_FILTER_KEYS } from "@/features/transactions/history-schema";
import { useShowHistoryFilters } from "@/features/transactions/hooks/use-show-history-filters";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { DatePicker } from "@/shared/components/date-picker";
import { Button } from "@/shared/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { cn } from "@/shared/helpers/cn";
import { useToday } from "@/shared/hooks/use-today";

type ApiWallet = components["schemas"]["Wallet"];
type ApiCategory = components["schemas"]["Category"];
type ApiTag = components["schemas"]["TagSummary"];

interface HistoryFilterPopoverProps {
  wallets: readonly ApiWallet[];
  categories: readonly ApiCategory[];
  tags: readonly ApiTag[];
  /** The address's raw filter values: the one source of truth, so a bad value shows as typed. */
  values: Readonly<HistoryFilterValues>;
}

function Field({
  id,
  label,
  wide = false,
  children,
}: Readonly<{
  id: string;
  label: string;
  /** Spans both columns. */
  wide?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 text-sm font-semibold",
        wide && "col-span-2",
      )}
    >
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

/** Single-choice filters that are set, plus one per chosen tag. */
function activeFilterCount(values: Readonly<HistoryFilterValues>) {
  return (
    HISTORY_FILTER_KEYS.filter((key) => values[key] !== undefined).length +
    (values.tagId?.length ?? 0)
  );
}

/**
 * From 1024px the history's filters, stacked in two columns. Each change
 * writes the address at once, so there is nothing to apply.
 */
function HistoryFilterFields({
  wallets,
  categories,
  tags,
  values,
}: Readonly<HistoryFilterPopoverProps>) {
  const show = useShowHistoryFilters();
  const today = useToday();

  function change(key: HistoryFilterKey) {
    return (value: string) => show(changeHistoryFilter(values, { key, value }));
  }

  return (
    <search aria-label="Filter transactions" className="grid grid-cols-2 gap-3">
      <Field id="history-from" label="From">
        <DatePicker
          id="history-from"
          today={today}
          max={today}
          value={values.from ?? ""}
          onChange={change("from")}
          placeholder="Any date"
          clearable
          keepMalformed
        />
      </Field>
      <Field id="history-to" label="To">
        <DatePicker
          id="history-to"
          today={today}
          max={today}
          value={values.to ?? ""}
          onChange={change("to")}
          placeholder="Any date"
          clearable
          keepMalformed
        />
      </Field>
      <Field id="history-walletId" label="Wallet">
        <FilterSelect
          id="history-walletId"
          name="walletId"
          value={values.walletId ?? ""}
          onValueChange={change("walletId")}
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
      </Field>
      <Field id="history-type" label="Type">
        <FilterSelect
          id="history-type"
          name="type"
          value={values.type ?? ""}
          onValueChange={change("type")}
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
      </Field>
      <Field id="history-categoryId" label="Category" wide>
        <FilterSelect
          id="history-categoryId"
          name="categoryId"
          value={values.categoryId ?? ""}
          onValueChange={change("categoryId")}
          allLabel="All categories"
          groups={categoryGroups(categories)}
        />
      </Field>
      {/* Inline under a hairline, so choosing tags never stacks a second popover. */}
      <div className="col-span-2 border-t pt-3">
        <TagFilter
          tags={tags}
          chosen={values.tagId ?? []}
          onToggle={(tagId) => show(toggleHistoryTag(values, tagId))}
          compact
        />
      </div>
    </search>
  );
}

/** Filters in the table's toolbar: a button counting what is on, opening the filters. */
export function HistoryFilterPopover(
  props: Readonly<HistoryFilterPopoverProps>,
) {
  const count = activeFilterCount(props.values);
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <ListFilter aria-hidden="true" strokeWidth={1.75} />
        Filters{count > 0 ? ` · ${count}` : ""}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-(--available-height) w-[26rem] max-w-[calc(100vw-2rem)] [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] overflow-y-auto overscroll-contain p-4"
      >
        <HistoryFilterFields {...props} />
      </PopoverContent>
    </Popover>
  );
}
