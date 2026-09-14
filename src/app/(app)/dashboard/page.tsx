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
import { getMonthlySummary } from "@/features/transactions/server/history";
import { listWallets } from "@/features/wallets/server/wallet";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { APP_TIME_ZONE, todayIn } from "@/shared/helpers/dates";

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
  const values = {
    month: params.month ?? today.substring(0, today.lastIndexOf("-")),
    asOf: params.asOf ?? today,
  };
  const parsed = reportSchema.safeParse(values);
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
          <label
            htmlFor="report-month"
            className="flex min-w-0 flex-col gap-2 font-medium text-sm"
          >
            Report month
            <Input
              type="month"
              id="report-month"
              name="month"
              defaultValue={
                typeof values.month === "string" ? values.month : ""
              }
              className="h-11"
              required
            />
          </label>
          <label
            htmlFor="balance-date"
            className="flex min-w-0 flex-col gap-2 font-medium text-sm"
          >
            Balance date
            <Input
              type="date"
              id="balance-date"
              name="asOf"
              defaultValue={typeof values.asOf === "string" ? values.asOf : ""}
              className="h-11"
              required
            />
          </label>
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
