import { afterEach, describe, expect, test, vi } from "vitest";
import { walletFormSchema } from "./wallet-form-schema";

const validInput = {
  name: "Savings",
  type: "cash",
  openingAmount: "0",
  openingDate: "2026-09-13",
};
afterEach(() => vi.useRealTimers());
describe("wallet creation validation", () => {
  test("rejects future openings at Bangkok midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T16:59:59Z"));
    expect(
      walletFormSchema.safeParse({ ...validInput, openingDate: "2026-09-14" })
        .success,
    ).toBe(false);
    vi.setSystemTime(new Date("2026-09-13T17:00:00Z"));
    expect(
      walletFormSchema.safeParse({ ...validInput, openingDate: "2026-09-14" })
        .success,
    ).toBe(true);
  });
  test("accepts descriptive names longer than forty characters", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
    expect(
      walletFormSchema.safeParse({
        ...validInput,
        name: "Savings for our family holiday and upcoming home renovation",
      }).success,
    ).toBe(true);
  });
});
