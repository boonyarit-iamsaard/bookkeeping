import type { CalendarDate } from "@bookkeeping/domain/dates";
import { reportQueries, walletQueries } from "@/core/api/queries";
import type { ReportSearch, ReportValues } from "./report-schema";
import { reportSchema, reportValues } from "./report-schema";

interface ReportQueryPlan {
  valid: boolean;
  values: ReportValues;
  invalidFields: ReadonlySet<keyof ReportValues>;
  monthly: ReturnType<typeof reportQueries.monthly>;
  currentWallets: ReturnType<typeof walletQueries.list>;
  datedWallets: ReturnType<typeof walletQueries.list>;
}

/** One report address translated into validation state and its three reads. */
export function createReportQueryPlan(
  search: Readonly<ReportSearch>,
  today: CalendarDate,
): ReportQueryPlan {
  const values = reportValues(search, today);
  const parsed = reportSchema.safeParse(values);
  const invalidFields = new Set<keyof ReportValues>();
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "month" || field === "asOf") {
        invalidFields.add(field);
      }
    }
  }

  return {
    valid: parsed.success,
    values,
    invalidFields,
    monthly: reportQueries.monthly(values.month),
    currentWallets: walletQueries.list(),
    datedWallets: walletQueries.list({ asOf: values.asOf }),
  };
}
