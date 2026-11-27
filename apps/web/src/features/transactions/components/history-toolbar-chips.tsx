import { useNavigate } from "@tanstack/react-router";
import { TriangleAlert, X } from "lucide-react";
import { useId } from "react";
import type { components } from "@/core/api/openapi.gen";
import { historyFilterChips } from "@/features/transactions/history-chips";
import { historyTableSettings } from "@/features/transactions/history-pages";
import type { HistoryFilterValues } from "@/features/transactions/history-schema";
import type { HistoryView } from "@/features/transactions/history-view";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/helpers/cn";

interface HistoryToolbarChipsProps {
  wallets: readonly components["schemas"]["Wallet"][];
  categories: readonly components["schemas"]["Category"][];
  tags: readonly components["schemas"]["TagSummary"][];
  view: Readonly<HistoryView>;
}

/**
 * From 1024px the active filters at the table toolbar's start: 28px chips
 * reading "Wallet TTB", each ✕ lifting just its own filter, and Clear all
 * once there are two.
 */
export function HistoryToolbarChips({
  wallets,
  categories,
  tags,
  view,
}: Readonly<HistoryToolbarChipsProps>) {
  const navigate = useNavigate();
  const id = useId();
  const chips = historyFilterChips(view, { wallets, categories, tags });
  if (chips.length === 0) {
    return null;
  }

  function show(filters: HistoryFilterValues) {
    void navigate({
      to: "/transactions",
      search: (previous) => ({ ...historyTableSettings(previous), ...filters }),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul
        aria-label="Active filters"
        // contents: the chips and Clear all wrap as one row, so Clear all stays after the last chip.
        className="contents"
      >
        {chips.map((chip, index) => (
          <li
            key={chip.key}
            className={cn(
              "bg-secondary text-secondary-foreground flex h-7 max-w-full min-w-0 items-center gap-1 rounded-full pr-0.5 pl-3 text-[13px]",
              // Invalid reads by its dashed outline and pictogram, not red alone.
              chip.invalid && "border-destructive border border-dashed pl-2",
            )}
          >
            {chip.invalid && (
              <TriangleAlert
                aria-hidden="true"
                strokeWidth={1.75}
                className="text-destructive size-3.5 shrink-0"
              />
            )}
            <span className="shrink-0 opacity-80">{chip.field}</span>
            <span
              title={chip.value}
              className="max-w-72 truncate font-semibold"
            >
              {chip.value}
            </span>
            {chip.invalid && (
              <span id={`${id}-invalid-${index}`} className="sr-only">
                Not a value the history accepts
              </span>
            )}
            <button
              type="button"
              onClick={() => show(chip.without)}
              aria-label={`Remove ${chip.field.toLowerCase()} filter: ${chip.value}`}
              aria-describedby={
                chip.invalid ? `${id}-invalid-${index}` : undefined
              }
              className="focus-visible:ring-ring/45 flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-150 outline-none hover:bg-[color-mix(in_oklch,var(--secondary),var(--primary)_10%)] focus-visible:ring-[3px] motion-reduce:transition-none"
            >
              <X aria-hidden="true" strokeWidth={1.75} className="size-3" />
            </button>
          </li>
        ))}
      </ul>
      {chips.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => show({})}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
