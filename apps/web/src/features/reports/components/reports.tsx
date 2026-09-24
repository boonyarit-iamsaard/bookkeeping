import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { useBangkokToday } from "@/features/transactions/hooks/use-bangkok-today";
import { DatePicker } from "@/shared/components/date-picker";
import { MonthPicker } from "@/shared/components/month-picker";
import { Button } from "@/shared/components/ui/button";
import { reportMonthOf } from "../report-month";
import { createReportQueryPlan } from "../report-queries";
import type { ReportSearch } from "../report-schema";
import { FinancialReport } from "./financial-report";

interface ReportsProps {
  search: Readonly<ReportSearch>;
  initialToday: CalendarDate;
}

export function Reports({ search, initialToday }: Readonly<ReportsProps>) {
  const today = useBangkokToday(initialToday);
  const thisMonth = reportMonthOf(today);
  const plan = createReportQueryPlan(search, today);
  const report = useQuery({
    ...plan.monthly,
    enabled: plan.valid,
    throwOnError: true,
  });
  const currentWallets = useQuery({
    ...plan.currentWallets,
    enabled: plan.valid,
    throwOnError: true,
  });
  const datedWallets = useQuery({
    ...plan.datedWallets,
    enabled: plan.valid,
    throwOnError: true,
  });
  const navigate = useNavigate({ from: "/reports" });

  // Each control changes only its own value; the other keeps the address's,
  // so a malformed one stays visible until it is corrected.
  function showMonth(month: string) {
    void navigate({ search: { month, asOf: search.asOf } });
  }

  function updateBalanceDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextAsOf = new FormData(event.currentTarget).get("asOf");
    void navigate({
      search: {
        month: search.month,
        asOf: typeof nextAsOf === "string" ? nextAsOf : undefined,
      },
    });
  }

  return (
    <Page layout="wide">
      <TitleBar
        title="Reports"
        actions={
          <>
            <label htmlFor="report-month" className="sr-only">
              Report month
            </label>
            <MonthPicker
              key={plan.values.month}
              id="report-month"
              thisMonth={thisMonth}
              max={thisMonth}
              defaultValue={plan.values.month}
              invalid={plan.invalidFields.has("month")}
              onChange={showMonth}
              className="w-auto"
            />
          </>
        }
      />
      <form
        key={plan.values.asOf}
        aria-label="Report dates"
        className="flex flex-col gap-4 border-y py-5"
        onSubmit={updateBalanceDate}
      >
        {/* The grid keeps the control the width it had beside the month. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2 font-medium text-sm">
            <label htmlFor="balance-date">Balance date</label>
            <DatePicker
              id="balance-date"
              name="asOf"
              today={today}
              max={today}
              defaultValue={plan.values.asOf}
              invalid={plan.invalidFields.has("asOf")}
            />
          </div>
        </div>
        <Button
          type="submit"
          size="lg"
          variant="outline"
          className="self-start"
        >
          Update report
        </Button>
      </form>
      {plan.valid &&
      report.data !== undefined &&
      currentWallets.data !== undefined &&
      datedWallets.data !== undefined ? (
        <FinancialReport
          summary={report.data}
          currentWallets={currentWallets.data.items}
          datedWallets={datedWallets.data.items}
          asOf={plan.values.asOf}
        />
      ) : (
        <p role="alert" className="text-destructive text-sm">
          Choose a valid month and balance date.
        </p>
      )}
    </Page>
  );
}
