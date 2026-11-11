import { describe, expect, test } from "vitest";
import { createWalletFormSchema } from "./wallet-form-schema";

const validInput = {
  name: "Savings",
  type: "cash",
  savings: false,
  openingAmount: "0",
  openingDate: "2026-09-13",
};

describe("wallet creation validation", () => {
  test("accepts the Savings wallet marker", () => {
    expect(
      createWalletFormSchema({ today: "2026-09-13" }).parse({
        ...validInput,
        savings: true,
      }).savings,
    ).toBe(true);
  });

  test("rejects future openings until the supplied today advances", () => {
    expect(
      createWalletFormSchema({ today: "2026-09-13" }).safeParse({
        ...validInput,
        openingDate: "2026-09-14",
      }).success,
    ).toBe(false);
    expect(
      createWalletFormSchema({ today: "2026-09-14" }).safeParse({
        ...validInput,
        openingDate: "2026-09-14",
      }).success,
    ).toBe(true);
  });

  test("accepts descriptive names longer than forty characters", () => {
    expect(
      createWalletFormSchema({ today: "2026-09-13" }).safeParse({
        ...validInput,
        name: "Savings for our family holiday and upcoming home renovation",
      }).success,
    ).toBe(true);
  });
});
