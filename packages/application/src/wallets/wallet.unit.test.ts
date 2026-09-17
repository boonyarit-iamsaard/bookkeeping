import { afterEach, describe, expect, test, vi } from "vitest";
import type { WalletCreationCommand, WalletOpening } from "./wallet";
import { validateWalletCreation, validateWalletOpening } from "./wallet";

const command: WalletCreationCommand = {
  name: "Cash",
  type: "cash",
  openingAmount: 0n,
  openingDate: "2026-09-01",
};

describe("validateWalletCreation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("accepts a command and normalizes the name", () => {
    expect(
      validateWalletCreation({
        ...command,
        name: "  Kasikorn savings ",
        openingAmount: -999_999_999_999_999_99n,
      }),
    ).toEqual({
      ok: true,
      value: {
        ...command,
        name: "Kasikorn savings",
        openingAmount: -999_999_999_999_999_99n,
      },
    });
  });

  test("rejects a blank name", () => {
    expect(validateWalletCreation({ ...command, name: " \t" })).toEqual({
      ok: false,
      error: {
        code: "invalid-wallet",
        issues: [{ field: "name", code: "empty" }],
      },
    });
  });

  test("rejects an opening beyond fifteen whole baht digits in either sign", () => {
    for (const openingAmount of [
      1_000_000_000_000_000_00n,
      -1_000_000_000_000_000_00n,
    ]) {
      expect(validateWalletCreation({ ...command, openingAmount })).toEqual({
        ok: false,
        error: {
          code: "invalid-wallet",
          issues: [{ field: "openingAmount", code: "out-of-range" }],
        },
      });
    }
  });

  test("rejects a date that does not exist on the calendar", () => {
    expect(
      validateWalletCreation({ ...command, openingDate: "2026-02-30" }),
    ).toEqual({
      ok: false,
      error: {
        code: "invalid-wallet",
        issues: [{ field: "openingDate", code: "invalid" }],
      },
    });
  });

  test("rejects an opening date after today in Bangkok, not after today in UTC", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 17:30 UTC on the 13th is already the 14th in Bangkok.
    vi.setSystemTime(new Date("2026-09-13T17:30:00Z"));

    expect(
      validateWalletCreation({ ...command, openingDate: "2026-09-14" }).ok,
    ).toBe(true);
    expect(
      validateWalletCreation({ ...command, openingDate: "2026-09-15" }),
    ).toEqual({
      ok: false,
      error: {
        code: "invalid-wallet",
        issues: [{ field: "openingDate", code: "in-future" }],
      },
    });
  });

  test("reports every issue at once", () => {
    const result = validateWalletCreation({
      name: "",
      type: "cash",
      openingAmount: 10n ** 20n,
      openingDate: "tomorrow",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.issues.map((issue) => issue.field)).toEqual([
      "name",
      "openingAmount",
      "openingDate",
    ]);
  });
});

describe("validateWalletOpening", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("accepts an exact opening within the stored range", () => {
    const opening: WalletOpening = {
      openingAmount: -999_999_999_999_999_99n,
      openingDate: "2026-09-01",
    };

    expect(validateWalletOpening(opening)).toEqual({
      ok: true,
      value: opening,
    });
  });

  test("reports an out-of-range amount and an impossible date together", () => {
    expect(
      validateWalletOpening({
        openingAmount: 1_000_000_000_000_000_00n,
        openingDate: "2026-02-30",
      }),
    ).toEqual({
      ok: false,
      error: {
        code: "invalid-opening",
        issues: [
          { field: "openingAmount", code: "out-of-range" },
          { field: "openingDate", code: "invalid" },
        ],
      },
    });
  });

  test("rejects an opening date after today in Bangkok", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T17:30:00Z"));

    expect(
      validateWalletOpening({ openingAmount: 0n, openingDate: "2026-09-14" })
        .ok,
    ).toBe(true);
    expect(
      validateWalletOpening({ openingAmount: 0n, openingDate: "2026-09-15" }),
    ).toEqual({
      ok: false,
      error: {
        code: "invalid-opening",
        issues: [{ field: "openingDate", code: "in-future" }],
      },
    });
  });
});
