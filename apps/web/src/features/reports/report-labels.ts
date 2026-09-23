import type { components } from "@/core/api/openapi.gen";

type MonthlyReport = components["schemas"]["MonthlyReport"];

export type ReportFigure = keyof Pick<
  MonthlyReport,
  "income" | "grossExpenses" | "refunds" | "netExpenses" | "net"
>;

/** The monthly figures' row labels, shared by Reports and Home's This month. */
export const REPORT_FIGURE_LABELS = {
  income: "Income",
  grossExpenses: "Gross expenses",
  refunds: "Refunds",
  netExpenses: "Net expenses",
  net: "Net",
} as const satisfies Record<ReportFigure, string>;
