import { describe, expect, test } from "vitest";
import { scaleBars } from "./bar-scale";

describe("scaleBars", () => {
  test("starts positive bars at a zero line on the left when nothing is negative", () => {
    const { zero, bars } = scaleBars([200n, 100n]);
    expect(zero).toBe(0);
    expect(bars).toEqual([
      { start: 0, length: 1 },
      { start: 0, length: 0.5 },
    ]);
  });

  test("puts the zero line where the negative span ends and extends negatives left of it", () => {
    const { zero, bars } = scaleBars([100n, -50n]);
    expect(zero).toBeCloseTo(1 / 3);
    expect(bars[0].start).toBeCloseTo(1 / 3);
    expect(bars[0].length).toBeCloseTo(2 / 3);
    expect(bars[1].start).toBeCloseTo(0);
    expect(bars[1].length).toBeCloseTo(1 / 3);
  });

  test("puts the zero line at the right edge when everything is negative", () => {
    const { zero, bars } = scaleBars([-100n, -25n]);
    expect(zero).toBe(1);
    expect(bars).toEqual([
      { start: 0, length: 1 },
      { start: 0.75, length: 0.25 },
    ]);
  });

  test("draws nothing when every value is zero or there are none", () => {
    expect(scaleBars([0n, 0n])).toEqual({
      zero: 0,
      bars: [
        { start: 0, length: 0 },
        { start: 0, length: 0 },
      ],
    });
    expect(scaleBars([])).toEqual({ zero: 0, bars: [] });
  });

  test("keeps exact satang apart at seven figures", () => {
    const { bars } = scaleBars([1_000_000_000n, 999_999_999n]);
    expect(bars[0]).toHaveLength(1);
    expect(bars[1].length).toBeLessThan(1);
  });
});
