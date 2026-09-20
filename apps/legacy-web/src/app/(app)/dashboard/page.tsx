import { getMonthlySummary } from "@bookkeeping/application/transactions";
import { listWallets } from "@bookkeeping/application/wallets";
import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import { FinancialReport } from "@/features/transactions/components/financial-report";
import {
  nonemptySearchParams,
  reportSchema,
} from "@/features/transactions/history-schema";
import { DatePicker } from "@/shared/components/date-picker";
import { MonthPicker } from "@/shared/components/month-picker";
import { Button, buttonVariants } from "@/shared/components/ui/button";

export const metadata: Metadata = { title: "Monthly summary" };

export default async function Page({
  searchParams,
}: Readonly<PageProps<"/dashboard">>) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const params = nonemptySearchParams(await searchParams);
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  const thisMonth = today.substring(0, today.lastIndexOf("-"));
  const values = {
    month: params.month ?? thisMonth,
    asOf: params.asOf ?? today,
  };
  const parsed = reportSchema.safeParse(values);
  const invalidFields = new Set(
    parsed.success ? [] : parsed.error.issues.map((issue) => issue.path[0]),
  );
  const report = parsed.success
    ? await Promise.all([
        getMonthlySummary(db, {
          ownerId: session.user.id,
          month: parsed.data.month,
        }),
        listWallets(db, { ownerId: session.user.id }),
        listWallets(db, { ownerId: session.user.id, asOf: parsed.data.asOf }),
      ])
    : undefined;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl tracking-tight">
          Monthly summary
        </h1>
        <Link
          href="/transactions"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          View history
        </Link>
      </div>
      <Form
        key={JSON.stringify(values)}
        action="/dashboard"
        aria-label="Report dates"
        className="flex flex-col gap-4 border-y py-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2 font-medium text-sm">
            <label htmlFor="report-month">Report month</label>
            <MonthPicker
              id="report-month"
              name="month"
              thisMonth={thisMonth}
              max={thisMonth}
              defaultValue={
                typeof values.month === "string" ? values.month : ""
              }
              invalid={invalidFields.has("month")}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2 font-medium text-sm">
            <label htmlFor="balance-date">Balance date</label>
            <DatePicker
              id="balance-date"
              name="asOf"
              today={today}
              max={today}
              defaultValue={typeof values.asOf === "string" ? values.asOf : ""}
              invalid={invalidFields.has("asOf")}
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
      </Form>
      {report && parsed.success ? (
        <FinancialReport
          summary={report[0]}
          currentWallets={report[1]}
          datedWallets={report[2]}
          asOf={parsed.data.asOf}
        />
      ) : (
        <p role="alert" className="text-destructive text-sm">
          Choose a valid month and balance date, then update the report.
        </p>
      )}
    </main>
  );
}
