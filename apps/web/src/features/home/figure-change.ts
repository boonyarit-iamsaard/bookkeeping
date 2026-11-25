import type { ApiMoney } from "@/core/api/money";
import { parseApiMoney, presentApiMoney } from "@/core/api/money";

export interface FigureChange {
  direction: "up" | "down" | "same";
  /** The size of the change, never negative. */
  amount: ApiMoney;
}

function changeDirection(difference: bigint): FigureChange["direction"] {
  if (difference > 0n) {
    return "up";
  }
  return difference < 0n ? "down" : "same";
}

/** How a month's figure moved from the month before, exactly. */
export function figureChange(
  current: Readonly<ApiMoney>,
  previous: Readonly<ApiMoney>,
): FigureChange {
  const difference = parseApiMoney(current) - parseApiMoney(previous);
  return {
    direction: changeDirection(difference),
    amount: presentApiMoney({
      amountInMinorUnits: difference < 0n ? -difference : difference,
      currency: current.currency,
    }),
  };
}
