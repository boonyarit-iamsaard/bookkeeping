import { describe, expect, test } from "vitest";
import type { components } from "@/core/api/openapi.gen";
import { totalWalletBalance } from "@/features/wallets/wallet-total";

type ApiWallet = components["schemas"]["Wallet"];

function wallet(overrides: Partial<ApiWallet> = {}): ApiWallet {
  return {
    id: "wallet-1",
    name: "Cash",
    type: "cash",
    currency: "THB",
    openingDate: "2026-09-01",
    openingAmount: { value: "1000.00", currency: "THB" },
    balance: { value: "1234.50", currency: "THB" },
    archivedAt: null,
    ...overrides,
  };
}

describe("totalWalletBalance", () => {
  test("sums every wallet exactly, archived included", () => {
    expect(
      totalWalletBalance([
        wallet({ balance: { value: "0.10", currency: "THB" } }),
        wallet({
          id: "wallet-2",
          balance: { value: "0.20", currency: "THB" },
          archivedAt: "2026-09-10T00:00:00Z",
        }),
        wallet({
          id: "wallet-3",
          balance: { value: "-50.00", currency: "THB" },
        }),
      ]),
    ).toEqual({ value: "-49.70", currency: "THB" });
  });

  test("is zero with no wallets", () => {
    expect(totalWalletBalance([])).toEqual({ value: "0.00", currency: "THB" });
  });
});
