import type { CalendarDate } from "@bookkeeping/domain/dates";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import {
  BalanceDateField,
  ReportMonthField,
} from "@/features/reports/components/report-pickers";
import { createReportSections } from "@/features/reports/components/report-sections";
import {
  BalancesSkeleton,
  BalanceTrendSkeleton,
  CategoriesSkeleton,
  MonthSkeleton,
  TrendSkeleton,
} from "@/features/reports/components/reports-loading";
import { useReports } from "@/features/reports/hooks/use-reports";
import type { ReportSearch } from "@/features/reports/report-schema";
import { DashboardCard } from "@/shared/components/dashboard-card";
import { DashboardRow } from "@/shared/components/dashboard-row";
import { HeroSkeleton, Skeleton } from "@/shared/components/skeleton";

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
      </div>
    </Page>
  );
}

/** The report's sections as dashboard cards, two to a row. */
export function ReportsDesktop({
  search,
  initialToday,
}: Readonly<ReportsDesktopProps>) {
  const { state, sections, ...pickers } = useReports({
    search,
    initialToday,
  });
  if (state === "loading") {
    return <ReportsDesktopLoading />;
  }
  const balanceDate = <BalanceDateField {...pickers.balanceDate} />;
  const cards = sections
    ? createReportSections({ ...sections, balanceDate }, DashboardCard)
    : undefined;

  return (
    <Page layout="wide">
      <TitleBar
        title="Reports"
        actions={<ReportMonthField {...pickers.reportMonth} />}
      />
      {cards ? (
        <>
          <DashboardRow className={ROW_4_8}>
            {cards.net}
            {cards.monthCard}
          </DashboardRow>
          <DashboardRow className={ROW_6_6}>
            {cards.categories}
            {cards.trendCard}
          </DashboardRow>
          <DashboardRow className={ROW_5_7}>
            {cards.balances}
            {cards.overTime}
          </DashboardRow>
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
