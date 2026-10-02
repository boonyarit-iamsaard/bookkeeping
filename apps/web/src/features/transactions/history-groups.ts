import type { components } from "@/core/api/openapi.gen";

type ApiTransaction = components["schemas"]["Transaction"];

export interface HistoryGroup {
  /** "2026-09", the month the rows' transaction dates fall in. */
  key: string;
  /** "September 2026" */
  label: string;
  transactions: ApiTransaction[];
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

/**
 * History rows in the order the API returned them, split into runs by the
 * month of their transaction date. The API sorts by date, so each month is
 * one run; a month cut by a page boundary continues under its own heading on
 * the next page.
 */
export function groupHistoryByMonth(
  transactions: readonly ApiTransaction[],
): HistoryGroup[] {
  const groups: HistoryGroup[] = [];
  for (const transaction of transactions) {
    const key = transaction.transactionDate.slice(0, 7);
    const last = groups.at(-1);
    if (last?.key === key) {
      last.transactions.push(transaction);
    } else {
      groups.push({ key, label: monthLabel(key), transactions: [transaction] });
    }
  }
  return groups;
}
