import type { CalendarDate } from "@bookkeeping/domain/dates";
import {
  reportQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { reportMonthOf } from "@/features/reports/report-month";

// Enough to confirm what was just recorded; history holds the rest.
const RECENT_TRANSACTION_LIMIT = "10";

/** Home's three reads for Bangkok's `today`, shared by its loader and screen. */
export function createHomeQueryPlan(today: CalendarDate) {
  return {
    wallets: walletQueries.list(),
    monthly: reportQueries.monthly(reportMonthOf(today)),
    recent: transactionQueries.list({ limit: RECENT_TRANSACTION_LIMIT }),
  };
}
