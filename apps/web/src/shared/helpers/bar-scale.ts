export interface Bar {
  /** Where the bar's left edge sits, as a fraction of the track. */
  start: number;
  /** How much of the track the bar covers. */
  length: number;
}

interface BarScale {
  /** Where the zero line sits, as a fraction of the track from the left. */
  zero: number;
  bars: Bar[];
}

function fractionOf(part: bigint, whole: bigint): number {
  return Number(part) / Number(whole);
}

/**
 * Bars on one track from a shared zero line: positive values run right of it,
 * negative ones left, and the track is only as wide as the values need.
 */
export function scaleBars(values: readonly bigint[]): BarScale {
  const lowest = values.reduce((low, value) => (value < low ? value : low), 0n);
  const highest = values.reduce(
    (high, value) => (value > high ? value : high),
    0n,
  );
  const span = highest - lowest;
  if (span === 0n) {
    return {
      zero: 0,
      bars: values.map(() => ({ start: 0, length: 0 })),
    };
  }
  const zero = fractionOf(-lowest, span);
  return {
    zero,
    bars: values.map((value) => {
      const length = fractionOf(value < 0n ? -value : value, span);
      return { start: value < 0n ? zero - length : zero, length };
    }),
  };
}

/** A fraction of a track as a CSS percentage. */
export function toPercent(fraction: number): string {
  return `${fraction * 100}%`;
}
