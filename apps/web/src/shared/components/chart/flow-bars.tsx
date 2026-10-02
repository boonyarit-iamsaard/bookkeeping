import type { ApiMoney } from "@/core/api/money";
import { parseApiMoney } from "@/core/api/money";
import { Money } from "@/shared/components/money";
import { scaleBars } from "@/shared/helpers/bar-scale";
import { BarTrack } from "./bar-track";
import type { ChartSeries } from "./chart-series";
import { ChartSwatch } from "./chart-swatch";

interface FlowBarsProps {
  income: ApiMoney;
  netExpenses: ApiMoney;
  /** Reports states each figure beside its bar; Home's figures sit just above. */
  showAmounts: boolean;
}

interface FlowRow {
  label: string;
  series: ChartSeries;
  amount: ApiMoney;
}

/**
 * The month's Income against its Net expenses on one scale, Income first: the
 * level 1 chart. Net expenses is solid amber.
 */
export function FlowBars({
  income,
  netExpenses,
  showAmounts,
}: Readonly<FlowBarsProps>) {
  const rows: FlowRow[] = [
    { label: "Income", series: "income", amount: income },
    { label: "Net expenses", series: "expense", amount: netExpenses },
  ];
  const { zero, bars } = scaleBars(
    rows.map((row) => parseApiMoney(row.amount)),
  );

  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((row, index) => (
        <div key={row.series} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <ChartSwatch series={row.series} />
              {row.label}
            </span>
            {showAmounts && <Money amount={row.amount} />}
          </div>
          <BarTrack bar={bars[index]} zero={zero} series={row.series} />
        </div>
      ))}
    </div>
  );
}
