import { describe, expect, test } from "vitest";
import { figureChange } from "./figure-change";

function thb(value: string) {
  return { value, currency: "THB" } as const;
}

describe("figureChange", () => {
  test("reads a rise as up by the exact difference", () => {
    expect(figureChange(thb("1250.50"), thb("1000.25"))).toEqual({
      direction: "up",
      amount: thb("250.25"),
    });
  });

  test("reads a fall as down by its size, never a negative amount", () => {
    expect(figureChange(thb("-300.00"), thb("200.00"))).toEqual({
      direction: "down",
      amount: thb("500.00"),
    });
  });

  test("reads equal figures as the same", () => {
    expect(figureChange(thb("80.00"), thb("80.00"))).toEqual({
      direction: "same",
      amount: thb("0.00"),
    });
  });
});
