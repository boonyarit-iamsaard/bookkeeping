import { describe, expect, test } from "vitest";
import type { WalletCreationCommand, WalletOpening } from "./wallet";
import { acceptWalletCreation, acceptWalletOpening } from "./wallet";

const command: WalletCreationCommand = {
  name: "Cash",
  type: "cash",
  savings: false,
  openingAmount: 0n,
  openingDate: "2026-09-01",
};

const facts = { today: "2026-09-14", earliestMovementDate: null };

describe("acceptWalletCreation", () => {
  test("accepts a command and normalizes the name", () => {
    expect(
      acceptWalletCreation(
        {
          ...command,
          name: "  Kasikorn savings ",
          openingAmount: -999_999_999_999_999_99n,
        },
        facts,
      ),
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
    expect(acceptWalletCreation({ ...command, name: " \t" }, facts)).toEqual({
      ok: false,
      error: {
        code: "rejected",
        rejections: [{ code: "empty", field: "name" }],
      },
    });
  });

  test("rejects an opening beyond fifteen whole baht digits in either sign", () => {
    for (const openingAmount of [
      1_000_000_000_000_000_00n,
      -1_000_000_000_000_000_00n,
    ]) {
      expect(
        acceptWalletCreation({ ...command, openingAmount }, facts),
      ).toEqual({
        ok: false,
        error: {
          code: "rejected",
          rejections: [{ code: "out-of-range", field: "openingAmount" }],
        },
      });
    }
  });

  test("rejects a date that does not exist on the calendar", () => {
    expect(
      acceptWalletCreation({ ...command, openingDate: "2026-02-30" }, facts),
    ).toEqual({
      ok: false,
      error: {
        code: "rejected",
        rejections: [{ code: "invalid", field: "openingDate" }],
      },
    });
  });

  test("judges future opening dates against the supplied today", () => {
    expect(
      acceptWalletCreation({ ...command, openingDate: "2026-09-14" }, facts).ok,
    ).toBe(true);
    expect(
      acceptWalletCreation({ ...command, openingDate: "2026-09-15" }, facts),
    ).toEqual({
      ok: false,
      error: {
        code: "rejected",
        rejections: [{ code: "in-future", field: "openingDate" }],
      },
    });
  });

  test("reports every issue at once", () => {
    const result = acceptWalletCreation(
      {
        name: "",
        type: "cash",
        savings: false,
        openingAmount: 10n ** 20n,
        openingDate: "tomorrow",
      },
      facts,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.rejections.map((rejection) => rejection.field)).toEqual(
      ["name", "openingAmount", "openingDate"],
    );
  });
});

describe("acceptWalletOpening", () => {
  test("accepts an exact opening within the stored range without movements", () => {
    const opening: WalletOpening = {
      openingAmount: -999_999_999_999_999_99n,
      openingDate: "2026-09-01",
    };

    expect(acceptWalletOpening(opening, facts)).toEqual({
      ok: true,
      value: opening,
    });
  });

  test("reports an out-of-range amount and an impossible date together", () => {
    expect(
      acceptWalletOpening(
        {
          openingAmount: 1_000_000_000_000_000_00n,
          openingDate: "2026-02-30",
        },
        facts,
      ),
    ).toEqual({
      ok: false,
      error: {
        code: "rejected",
        rejections: [
          { code: "out-of-range", field: "openingAmount" },
          { code: "invalid", field: "openingDate" },
        ],
      },
    });
  });

  test("judges future opening dates against the supplied today", () => {
    expect(
      acceptWalletOpening(
        { openingAmount: 0n, openingDate: "2026-09-14" },
        facts,
      ).ok,
    ).toBe(true);
    expect(
      acceptWalletOpening(
        { openingAmount: 0n, openingDate: "2026-09-15" },
        facts,
      ),
    ).toEqual({
      ok: false,
      error: {
        code: "rejected",
        rejections: [{ code: "in-future", field: "openingDate" }],
      },
    });
  });

  test.each([
    { openingDate: "2999-02-30", code: "invalid" },
    { openingDate: "2026-09-15", code: "in-future" },
    { openingDate: "2026-09-03", code: "movement-before-opening" },
  ])(
    "reports only $code for openingDate alongside an out-of-range amount",
    ({ openingDate, code }) => {
      expect(
        acceptWalletOpening(
          {
            openingAmount: 1_000_000_000_000_000_00n,
            openingDate,
          },
          { today: "2026-09-14", earliestMovementDate: "2026-09-02" },
        ),
      ).toEqual({
        ok: false,
        error: {
          code: "rejected",
          rejections: [
            { code: "out-of-range", field: "openingAmount" },
            { code, field: "openingDate" },
          ],
        },
      });
    },
  );

  test.each([
    { openingDate: "2026-09-01", earliestMovementDate: "2026-09-02" },
    { openingDate: "2026-09-02", earliestMovementDate: "2026-09-02" },
    { openingDate: "2026-09-03", earliestMovementDate: null },
  ])(
    "accepts $openingDate with earliest movement $earliestMovementDate",
    ({ openingDate, earliestMovementDate }) => {
      const opening = { openingAmount: 0n, openingDate };
      expect(
        acceptWalletOpening(opening, {
          today: "2026-09-14",
          earliestMovementDate,
        }),
      ).toEqual({ ok: true, value: opening });
    },
  );
});
