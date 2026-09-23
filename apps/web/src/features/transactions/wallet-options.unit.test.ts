import { describe, expect, test } from "vitest";
import type { components } from "@/core/api/openapi.gen";
import {
  resolveDefaultWalletId,
  toWalletOptions,
} from "@/features/transactions/wallet-options";

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

describe("toWalletOptions", () => {
  test("offers active wallets with their balances as labels", () => {
    expect(
      toWalletOptions([
        wallet(),
        wallet({
          id: "wallet-2",
          name: "Old",
          archivedAt: "2026-09-10T00:00:00Z",
        }),
      ]),
    ).toEqual([
      {
        id: "wallet-1",
        name: "Cash",
        type: "cash",
        openingDate: "2026-09-01",
        archived: false,
        balanceLabel: "฿1,234.50",
      },
    ]);
  });

  test("keeps an archived wallet a transaction already points at, marked archived", () => {
    const options = toWalletOptions(
      [
        wallet(),
        wallet({
          id: "wallet-2",
          name: "Old",
          archivedAt: "2026-09-10T00:00:00Z",
        }),
        wallet({
          id: "wallet-3",
          name: "Older",
          archivedAt: "2026-09-10T00:00:00Z",
        }),
      ],
      { retainedWalletIds: ["wallet-2"] },
    );
    expect(options.map((option) => [option.id, option.archived])).toEqual([
      ["wallet-1", false],
      ["wallet-2", true],
    ]);
  });
});

describe("resolveDefaultWalletId", () => {
  const activeWallets = [{ id: "wallet-1" }, { id: "wallet-2" }];

  test("uses the requested active wallet before the last-used wallet", () => {
    expect(
      resolveDefaultWalletId({
        requestedWalletId: "wallet-2",
        lastUsedWalletId: "wallet-1",
        activeWallets,
      }),
    ).toBe("wallet-2");
  });

  test("falls back from an unavailable requested wallet to the last-used wallet", () => {
    expect(
      resolveDefaultWalletId({
        requestedWalletId: "archived-wallet",
        lastUsedWalletId: "wallet-2",
        activeWallets,
      }),
    ).toBe("wallet-2");
  });

  test("falls back to the first active wallet when the last-used wallet is unavailable", () => {
    expect(
      resolveDefaultWalletId({
        requestedWalletId: undefined,
        lastUsedWalletId: "archived-wallet",
        activeWallets,
      }),
    ).toBe("wallet-1");
  });

  test("returns undefined when there are no active wallets", () => {
    expect(
      resolveDefaultWalletId({
        requestedWalletId: undefined,
        lastUsedWalletId: undefined,
        activeWallets: [],
      }),
    ).toBeUndefined();
  });
});
