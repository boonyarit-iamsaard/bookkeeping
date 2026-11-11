import { describe, expect, it } from "vitest";
import { apiMoneySchema, parseApiMoney, presentApiMoney } from "./money";

describe("the API money edge", () => {
  it.each([0n, 1n, -1n, 120_000n, -987_654_321n])(
    "returns %s satang unchanged after a round trip through the wire form",
    (amountInMinorUnits) => {
      const wire = presentApiMoney({ amountInMinorUnits, currency: "THB" });

      expect(parseApiMoney(wire)).toBe(amountInMinorUnits);
      expect(apiMoneySchema.parse(wire)).toBe(amountInMinorUnits);
    },
  );

  it("returns the wire form unchanged after a round trip through satang", () => {
    const wire = { value: "-1234.50", currency: "THB" } as const;

    expect(
      presentApiMoney({
        amountInMinorUnits: parseApiMoney(wire),
        currency: wire.currency,
      }),
    ).toEqual(wire);
  });

  it("rejects a wire amount in an unsupported currency", () => {
    expect(
      apiMoneySchema.safeParse({ value: "1.00", currency: "USD" }).success,
    ).toBe(false);
  });
});
