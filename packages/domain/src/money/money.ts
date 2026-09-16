import type { Result } from "../result/result";
import { err, ok } from "../result/result";

export type MoneyParseError =
  | "empty"
  | "invalid"
  | "too-many-decimals"
  | "too-large";

// Keeps every stored value comfortably inside PostgreSQL bigint.
const MAX_WHOLE_DIGITS = 15;
const AMOUNT_PATTERN = /^(-)?(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/;
export type Currency = "THB";
const CURRENCIES = {
  THB: { symbol: "฿", minorUnitsPerMajorUnit: 100n },
} as const;

interface MoneyInput {
  text: string;
  currency: Currency;
}

interface MoneyAmount {
  amountInMinorUnits: bigint;
  currency: Currency;
}
const MINUS_SIGN = "−";

/**
 * Parses a decimal THB string into integer satang without ever touching
 * floating point. "1.1" and "1.10" both parse to 110n.
 */
export function parseMoneyInput({
  text: input,
  currency,
}: Readonly<MoneyInput>): Result<bigint, MoneyParseError> {
  const text = input.trim();
  const { minorUnitsPerMajorUnit } = CURRENCIES[currency];
  if (text === "") {
    return err("empty");
  }

  const match = AMOUNT_PATTERN.exec(text);
  if (!match) {
    return err("invalid");
  }

  const [, sign, groupedWhole, fraction = ""] = match;
  const whole = groupedWhole.replaceAll(",", "");
  if (fraction.length > 2) {
    return err("too-many-decimals");
  }
  if (whole.length > MAX_WHOLE_DIGITS) {
    return err("too-large");
  }

  const amountInMinorUnits =
    BigInt(whole) * minorUnitsPerMajorUnit + BigInt(fraction.padEnd(2, "0"));
  return ok(sign ? -amountInMinorUnits : amountInMinorUnits);
}

const wholeAmountFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export interface MoneyParts {
  /** "−" for negative amounts, otherwise "". */
  sign: string;
  symbol: string;
  /** Grouped whole baht, e.g. "12,000". */
  whole: string;
  /** Always two digits of satang, e.g. "05". */
  fraction: string;
}

/** Splits integer satang into display parts so a figure can be typeset with hierarchy. */
export function formatMoneyParts({
  amountInMinorUnits,
  currency,
}: Readonly<MoneyAmount>): MoneyParts {
  const { symbol, minorUnitsPerMajorUnit } = CURRENCIES[currency];
  const negative = amountInMinorUnits < 0n;
  const magnitude = negative ? -amountInMinorUnits : amountInMinorUnits;
  return {
    sign: negative ? MINUS_SIGN : "",
    symbol,
    whole: wholeAmountFormatter.format(magnitude / minorUnitsPerMajorUnit),
    fraction: (magnitude % minorUnitsPerMajorUnit).toString().padStart(2, "0"),
  };
}

/** Formats integer satang as "฿12,000.00"; negatives use a true minus sign. */
export function formatMoney(amount: Readonly<MoneyAmount>): string {
  const { sign, symbol, whole, fraction } = formatMoneyParts(amount);
  return `${sign}${symbol}${whole}.${fraction}`;
}

/**
 * Formats integer satang as plain input text, "120.50", with no symbol or
 * grouping, so a stored amount loads into a form and parses back unchanged.
 */
export function formatMoneyInput({
  amountInMinorUnits,
  currency,
}: Readonly<MoneyAmount>): string {
  const { minorUnitsPerMajorUnit } = CURRENCIES[currency];
  const negative = amountInMinorUnits < 0n;
  const magnitude = negative ? -amountInMinorUnits : amountInMinorUnits;
  const whole = (magnitude / minorUnitsPerMajorUnit).toString();
  const fraction = (magnitude % minorUnitsPerMajorUnit)
    .toString()
    .padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}
