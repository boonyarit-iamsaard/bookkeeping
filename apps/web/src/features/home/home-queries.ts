import type { CalendarDate } from "@bookkeeping/domain/dates";
import {
  categoryQueries,
  reportQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { reportMonthOf } from "@/features/reports/report-month";

// Enough to confirm what was just recorded; history holds the rest.
const RECENT_TRANSACTION_LIMIT = "10";

/** Home's reads for Bangkok's `today`, shared by its loader and screen. */
export function createHomeQueryPlan(today: CalendarDate) {
  return {
    // Recent rows take their category color from this read.
    categories: categoryQueries.list(),
    wallets: walletQueries.list(),
    monthly: reportQueries.monthly(reportMonthOf(today)),
    recent: transactionQueries.list({ limit: RECENT_TRANSACTION_LIMIT }),
  };
}
