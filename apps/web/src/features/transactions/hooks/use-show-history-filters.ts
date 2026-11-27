import { useNavigate } from "@tanstack/react-router";
import { historyTableSettings } from "@/features/transactions/history-pages";
import type { HistoryFilterValues } from "@/features/transactions/history-schema";

/** Shows the history under these filters, keeping the table's sort and page size. */
export function useShowHistoryFilters() {
  const navigate = useNavigate();
  return (filters: HistoryFilterValues) => {
    void navigate({
      to: "/transactions",
      search: (previous) => ({ ...historyTableSettings(previous), ...filters }),
    });
  };
}
