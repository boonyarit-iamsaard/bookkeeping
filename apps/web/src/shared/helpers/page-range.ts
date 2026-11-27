import type { PaginationState } from "@tanstack/react-table";

/**
 * A paged table's footer count: the count label alone on one page, else the
 * rows shown, such as "11–20 of 129 transactions".
 */
export function pageRangeLabel(
  { pageIndex, pageSize }: Readonly<PaginationState>,
  {
    rowCount,
    rowCountLabel,
  }: Readonly<{ rowCount: number; rowCountLabel: string }>,
): string {
  if (rowCount <= pageSize) {
    return rowCountLabel;
  }
  const first = pageIndex * pageSize + 1;
  const last = Math.min(first + pageSize - 1, rowCount);
  return `${first}–${last} of ${rowCountLabel}`;
}
