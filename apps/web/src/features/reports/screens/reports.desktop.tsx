import type { CalendarDate } from "@bookkeeping/domain/dates";
import { createReportSections } from "@/features/reports/components/report-sections";
import { Reports } from "@/features/reports/components/reports";
import {
  BalancesSkeleton,
  BalanceTrendSkeleton,
  CategoriesSkeleton,
  MonthSkeleton,
  ReportsLoading,
  TrendSkeleton,
} from "@/features/reports/components/reports-loading";
import type { ReportSearch } from "@/features/reports/report-schema";
import { DashboardCard } from "@/shared/components/dashboard-card";
import { DashboardRow } from "@/shared/components/dashboard-row";
import { HeroSkeleton } from "@/shared/components/skeleton";

interface ReportsDesktopProps {
  search: Readonly<ReportSearch>;
  initialToday: CalendarDate;
}

// The cards pair up, 4 + 8, 6 + 6 and 5 + 7 of twelve columns.
const ROW_4_8 = "grid-cols-[minmax(0,4fr)_minmax(0,8fr)]";
const ROW_6_6 = "grid-cols-2";
const ROW_5_7 = "grid-cols-[minmax(0,5fr)_minmax(0,7fr)]";

/** The desktop Reports in neutral blocks, in the ready report's rows so nothing moves when it arrives. */
export function ReportsDesktopLoading() {
  return (
    <ReportsLoading className="contents">
      <DashboardRow className={ROW_4_8}>
        <HeroSkeleton captionClassName="w-36" />
        <MonthSkeleton />
      </DashboardRow>
      <DashboardRow className={ROW_6_6}>
        <CategoriesSkeleton />
        <TrendSkeleton />
      </DashboardRow>
      <DashboardRow className={ROW_5_7}>
        <BalancesSkeleton />
        <BalanceTrendSkeleton />
      </DashboardRow>
    </ReportsLoading>
  );
}

/** The report's sections as dashboard cards, two to a row. */
export function ReportsDesktop({
  search,
  initialToday,
}: Readonly<ReportsDesktopProps>) {
  return (
    <Reports
      search={search}
      initialToday={initialToday}
      loading={<ReportsDesktopLoading />}
    >
      {(report) => {
        const { net, monthCard, categories, trendCard, balances, overTime } =
          createReportSections(report, DashboardCard);
        return (
          <>
            <DashboardRow className={ROW_4_8}>
              {net}
              {monthCard}
            </DashboardRow>
            <DashboardRow className={ROW_6_6}>
              {categories}
              {trendCard}
            </DashboardRow>
            <DashboardRow className={ROW_5_7}>
              {balances}
              {overTime}
            </DashboardRow>
          </>
        );
      }}
    </Reports>
  );
}
