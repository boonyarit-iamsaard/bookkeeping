import { describe, expect, it } from "vitest";
import { moneySchema, presentMoney } from "./money.js";

describe("presentMoney", () => {
  it("presents satang as a two-fraction-digit major-unit decimal with its currency", () => {
    expect(
      presentMoney({ amountInMinorUnits: 12550n, currency: "THB" }),
    ).toEqual({ value: "125.50", currency: "THB" });
    expect(presentMoney({ amountInMinorUnits: 0n, currency: "THB" })).toEqual({
      value: "0.00",
      currency: "THB",
    });
    expect(presentMoney({ amountInMinorUnits: -5n, currency: "THB" })).toEqual({
      value: "-0.05",
      currency: "THB",
    });
  });

  it("stays exact beyond the safe JavaScript integer range", () => {
    expect(
      presentMoney({
        amountInMinorUnits: 9_999_999_999_999_999n,
        currency: "THB",
      }),
    ).toEqual({ value: "99999999999999.99", currency: "THB" });
  });

  it("produces values the response schema accepts and never a bigint", () => {
    const money = presentMoney({ amountInMinorUnits: 12550n, currency: "THB" });

    expect(moneySchema.safeParse(money).success).toBe(true);
    expect(JSON.parse(JSON.stringify(money))).toEqual(money);
  });
});
