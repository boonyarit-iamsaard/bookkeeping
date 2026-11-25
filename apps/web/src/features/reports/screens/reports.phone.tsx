import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { ReportCardProps } from "@/features/reports/components/report-sections";
import { createReportSections } from "@/features/reports/components/report-sections";
import { Reports } from "@/features/reports/components/reports";
import {
  BalanceDateSkeleton,
  BalancesSkeleton,
  BalanceTrendSkeleton,
  CARD_CLASS,
  CategoriesSkeleton,
  MonthSkeleton,
  ReportsLoading,
  TrendSkeleton,
} from "@/features/reports/components/reports-loading";
import type { ReportSearch } from "@/features/reports/report-schema";
import { HeroSkeleton } from "@/shared/components/skeleton";

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
    <ReportsLoading className="flex flex-col gap-6 sm:gap-8">
      <BalanceDateSkeleton />
      <HeroSkeleton captionClassName="w-36" />
      <MonthSkeleton />
      <CategoriesSkeleton />
      <TrendSkeleton />
      <BalancesSkeleton />
      <BalanceTrendSkeleton />
    </ReportsLoading>
  );
}

/** The report's sections in one column. */
export function ReportsPhone({
  search,
  initialToday,
}: Readonly<ReportsPhoneProps>) {
  return (
    <Reports
      search={search}
      initialToday={initialToday}
      loading={<ReportsPhoneLoading />}
    >
      {(report) => {
        const { net, monthCard, categories, trendCard, balances, overTime } =
          createReportSections(report, PhoneReportCard);
        return (
          <>
            {net}
            {monthCard}
            {categories}
            {trendCard}
            {balances}
            {overTime}
          </>
        );
      }}
    </Reports>
  );
}
