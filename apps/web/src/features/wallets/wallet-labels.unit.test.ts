import { describe, expect, test } from "vitest";
import { walletCountLabel } from "@/features/wallets/wallet-labels";

describe("walletCountLabel", () => {
  test("counts in words", () => {
    expect(walletCountLabel(1)).toBe("1 wallet");
    expect(walletCountLabel(3)).toBe("3 wallets");
  });
});
