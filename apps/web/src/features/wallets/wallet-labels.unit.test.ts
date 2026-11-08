import { describe, expect, test } from "vitest";
import {
  walletCaption,
  walletCountLabel,
} from "@/features/wallets/wallet-labels";

describe("walletCountLabel", () => {
  test("counts in words", () => {
    expect(walletCountLabel(1)).toBe("1 wallet");
    expect(walletCountLabel(3)).toBe("3 wallets");
  });
});

describe("walletCaption", () => {
  test("names the type of an active wallet", () => {
    expect(
      walletCaption({ type: "bank_account", savings: false, archivedAt: null }),
    ).toBe("Bank account");
  });

  test("follows the type with Savings when marked", () => {
    expect(
      walletCaption({ type: "bank_account", savings: true, archivedAt: null }),
    ).toBe("Bank account · Savings");
  });

  test("follows the type with Archived once archived", () => {
    expect(
      walletCaption({
        type: "bank_account",
        savings: false,
        archivedAt: "2026-09-20T03:00:00.000Z",
      }),
    ).toBe("Bank account · Archived");
  });

  test("puts Savings before Archived when both apply", () => {
    expect(
      walletCaption({
        type: "bank_account",
        savings: true,
        archivedAt: "2026-09-20T03:00:00.000Z",
      }),
    ).toBe("Bank account · Savings · Archived");
  });
});
