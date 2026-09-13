import { describe, expect, test } from "vitest";
import { formatMoney, parseMoneyInput } from "@/shared/helpers/money";

describe("parseMoneyInput", () => {
  test("parses whole baht into satang exactly", () => {
    expect(parseMoneyInput({ text: "12000", currency: "THB" })).toEqual({
      ok: true,
      value: 1_200_000n,
    });
  });

  test("parses two decimals without floating-point drift", () => {
    expect(parseMoneyInput({ text: "0.29", currency: "THB" })).toEqual({
      ok: true,
      value: 29n,
    });
    expect(parseMoneyInput({ text: "1.10", currency: "THB" })).toEqual({
      ok: true,
      value: 110n,
    });
    expect(parseMoneyInput({ text: "1.1", currency: "THB" })).toEqual({
      ok: true,
      value: 110n,
    });
  });

  test("accepts amounts beyond signed 32-bit satang", () => {
    expect(parseMoneyInput({ text: "99999999.99", currency: "THB" })).toEqual({
      ok: true,
      value: 9_999_999_999n,
    });
  });

  test("accepts zero and negative openings", () => {
    expect(parseMoneyInput({ text: "0", currency: "THB" })).toEqual({
      ok: true,
      value: 0n,
    });
    expect(parseMoneyInput({ text: "-120.50", currency: "THB" })).toEqual({
      ok: true,
      value: -12_050n,
    });
  });

  test("ignores surrounding whitespace and thousands separators", () => {
    expect(parseMoneyInput({ text: " 12,000.00 ", currency: "THB" })).toEqual({
      ok: true,
      value: 1_200_000n,
    });
  });

  test("rejects more than two decimals instead of rounding", () => {
    expect(parseMoneyInput({ text: "1.005", currency: "THB" })).toEqual({
      ok: false,
      error: "too-many-decimals",
    });
  });

  test.each(["1,23", "1,2", "1.2,3", ",123", "123,", "12,34,567"])(
    "rejects malformed grouping: %s",
    (input) => {
      expect(parseMoneyInput({ text: input, currency: "THB" })).toEqual({
        ok: false,
        error: "invalid",
      });
    },
  );

  test("rejects empty and malformed input", () => {
    expect(parseMoneyInput({ text: "", currency: "THB" })).toEqual({
      ok: false,
      error: "empty",
    });
    expect(parseMoneyInput({ text: "abc", currency: "THB" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(parseMoneyInput({ text: "1.", currency: "THB" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(parseMoneyInput({ text: ".5", currency: "THB" })).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  test("rejects amounts too large to store", () => {
    expect(
      parseMoneyInput({ text: "1000000000000000", currency: "THB" }),
    ).toEqual({
      ok: false,
      error: "too-large",
    });
  });
});

describe("formatMoney", () => {
  test("shows currency, grouping, and two decimals", () => {
    expect(
      formatMoney({ amountInMinorUnits: 1_200_000n, currency: "THB" }),
    ).toBe("฿12,000.00");
    expect(formatMoney({ amountInMinorUnits: 29n, currency: "THB" })).toBe(
      "฿0.29",
    );
    expect(formatMoney({ amountInMinorUnits: 0n, currency: "THB" })).toBe(
      "฿0.00",
    );
  });

  test("formats negatives with a true minus sign", () => {
    expect(formatMoney({ amountInMinorUnits: -12_050n, currency: "THB" })).toBe(
      "−฿120.50",
    );
  });

  test("formats totals beyond signed 32-bit satang", () => {
    expect(
      formatMoney({ amountInMinorUnits: 9_999_999_999n, currency: "THB" }),
    ).toBe("฿99,999,999.99");
  });
});
