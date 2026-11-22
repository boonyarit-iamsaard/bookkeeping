import { TRANSACTION_TYPES } from "@bookkeeping/domain/transactions";
import { useNavigate } from "@tanstack/react-router";
import { Hash } from "lucide-react";
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
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { DatePicker } from "@/shared/components/date-picker";
import { Button } from "@/shared/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { useToday } from "@/shared/hooks/use-today";

type ApiWallet = components["schemas"]["Wallet"];
type ApiCategory = components["schemas"]["Category"];
type ApiTag = components["schemas"]["TagSummary"];

interface HistoryFilterBarProps {
  wallets: readonly ApiWallet[];
  categories: readonly ApiCategory[];
  tags: readonly ApiTag[];
  /** The address's raw filter values: the one source of truth, so a bad value shows as typed. */
  values: Readonly<HistoryFilterValues>;
}

function Field({
  id,
  label,
  children,
}: Readonly<{ id: string; label: string; children: React.ReactNode }>) {
  return (
    <div className="flex w-44 min-w-0 flex-col gap-1.5 text-sm font-semibold">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

/**
 * From 1024px the history's filters sit in a bar above the table. Each change
 * writes the address at once, so there is nothing to apply and no chips: the
 * controls themselves show what is on.
 */
export function HistoryFilterBar({
  wallets,
  categories,
  tags,
  values,
}: Readonly<HistoryFilterBarProps>) {
  const navigate = useNavigate();
  const today = useToday();
  const chosenTags = values.tagId ?? [];

  function show(search: HistoryFilterValues) {
    void navigate({ to: "/transactions", search });
  }

  function change(key: HistoryFilterKey) {
    return (value: string) => show(changeHistoryFilter(values, { key, value }));
  }

  return (
    <search
      aria-label="Filter transactions"
      className="flex flex-wrap items-end gap-3"
    >
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
      <Field id="history-categoryId" label="Category">
        <FilterSelect
          id="history-categoryId"
          name="categoryId"
          value={values.categoryId ?? ""}
          onValueChange={change("categoryId")}
          allLabel="All categories"
          groups={categoryGroups(categories)}
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
      <Popover>
        <PopoverTrigger render={<Button variant="outline" size="lg" />}>
          <Hash data-icon="inline-start" strokeWidth={1.75} />
          Tags{chosenTags.length > 0 ? ` · ${chosenTags.length}` : ""}
        </PopoverTrigger>
        <PopoverContent className="w-96 max-w-[calc(100vw-2rem)] p-4">
          <TagFilter
            tags={tags}
            chosen={chosenTags}
            onToggle={(tagId) => show(toggleHistoryTag(values, tagId))}
          />
        </PopoverContent>
      </Popover>
      {Object.keys(values).length > 0 && (
        <Button variant="ghost" size="lg" onClick={() => show({})}>
          Clear filters
        </Button>
      )}
    </search>
  );
}
