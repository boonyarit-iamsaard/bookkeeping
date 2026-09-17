import { describe, expect, it } from "vitest";
import { moneyInputSchema, moneySchema, presentMoney } from "./money.js";

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

describe("moneyInputSchema", () => {
  it("parses a decimal string to exact satang, whatever its fraction length", () => {
    for (const [value, expected] of [
      ["125", 12500n],
      ["125.5", 12550n],
      ["125.50", 12550n],
      ["0", 0n],
      ["-12000.50", -1_200_050n],
      ["999999999999999.99", 99_999_999_999_999_999n],
    ] as const) {
      expect(moneyInputSchema.parse({ value, currency: "THB" })).toEqual({
        amountInMinorUnits: expected,
        currency: "THB",
      });
    }
  });

  it("rejects anything but plain ASCII decimal notation", () => {
    for (const value of [
      "",
      " 125",
      "1,250",
      "125.",
      ".5",
      "1e3",
      "฿125",
      "+125",
      "125.505",
      "1234567890123456",
      "NaN",
    ]) {
      expect(
        moneyInputSchema.safeParse({ value, currency: "THB" }).success,
      ).toBe(false);
    }
  });

  it("rejects an unsupported currency and a numeric value", () => {
    expect(
      moneyInputSchema.safeParse({ value: "125.50", currency: "USD" }).success,
    ).toBe(false);
    expect(
      moneyInputSchema.safeParse({ value: 125.5, currency: "THB" }).success,
    ).toBe(false);
  });
});
