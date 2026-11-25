import type { CalendarDate } from "@bookkeeping/domain/dates";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import type { ReportCardProps } from "@/features/reports/components/report-sections";
import { createReportSections } from "@/features/reports/components/report-sections";
import {
  BalancesSkeleton,
  BalanceTrendSkeleton,
  CARD_CLASS,
  CategoriesSkeleton,
  MonthSkeleton,
  TrendSkeleton,
} from "@/features/reports/components/reports-loading";
import { useReports } from "@/features/reports/hooks/use-reports";
import type { ReportSearch } from "@/features/reports/report-schema";
import { HeroSkeleton, Skeleton } from "@/shared/components/skeleton";

interface ReportsPhoneProps {
  search: Readonly<ReportSearch>;
  initialToday: CalendarDate;
}

function PhoneReportCard({
  headingId,
  heading,
  children,
}: Readonly<ReportCardProps>) {
  return (
    <section aria-labelledby={headingId} className={CARD_CLASS}>
      <h2 id={headingId} className="text-lg font-bold tracking-tight">
        {heading}
      </h2>
      {children}
    </section>
  );
}

/** The phone Reports in neutral blocks. */
export function ReportsPhoneLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar
        title="Reports"
        actions={
          <div aria-hidden="true">
            <Skeleton className="h-11 w-44" />
          </div>
        }
      />
      <output className="text-muted-foreground text-sm">
        Loading your report…
      </output>
      <div aria-hidden="true" className="contents">
        <HeroSkeleton captionClassName="w-36" />
        <MonthSkeleton />
        <CategoriesSkeleton />
        <TrendSkeleton />
        <BalancesSkeleton />
        <BalanceTrendSkeleton />
      </div>
    </Page>
  );
}

/** The report's sections in one column. */
export function ReportsPhone({
  search,
  initialToday,
}: Readonly<ReportsPhoneProps>) {
  const { state, sections, reportMonth, balanceDate } = useReports({
    search,
    initialToday,
  });
  if (state === "loading") {
    return <ReportsPhoneLoading />;
  }
  const cards = sections
    ? createReportSections(sections, PhoneReportCard)
    : undefined;

  return (
    <Page layout="wide">
      <TitleBar title="Reports" actions={reportMonth} />
      {cards ? (
        <>
          {cards.net}
          {cards.monthCard}
          {cards.categories}
          {cards.trendCard}
          {cards.balances}
          {cards.overTime}
        </>
      ) : (
        <>
          <div className="bg-card shadow-card rounded-2xl p-5 sm:p-6">
            {balanceDate}
          </div>
          <p role="alert" className="text-destructive text-sm">
            Choose a valid month and balance date.
          </p>
        </>
      )}
    </Page>
  );
}
