import { describe, expect, test } from "vitest";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import {
  splitWalletBalance,
  totalWalletBalance,
} from "@/features/wallets/wallet-total";

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
    savings: false,
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

describe("splitWalletBalance", () => {
  test("does not split without any savings wallets", () => {
    expect(splitWalletBalance([])).toBeNull();
    expect(
      splitWalletBalance([wallet(), wallet({ id: "wallet-2" })]),
    ).toBeNull();
  });

  test("splits the exact total into spendable and set aside", () => {
    const wallets = [
      wallet({ balance: { value: "0.10", currency: "THB" } }),
      wallet({
        id: "wallet-2",
        savings: true,
        balance: { value: "0.20", currency: "THB" },
      }),
    ];
    const split = splitWalletBalance(wallets);

    expect(split).toEqual({
      total: { value: "0.30", currency: "THB" },
      spendable: { value: "0.10", currency: "THB" },
      setAside: { value: "0.20", currency: "THB" },
    });
    if (split === null) {
      throw new Error("Expected a savings balance split");
    }
    expect(parseApiMoney(split.spendable) + parseApiMoney(split.setAside)).toBe(
      parseApiMoney(split.total),
    );
    expect(split.total).toEqual(totalWalletBalance(wallets));
  });

  test("includes archived wallets in their respective balances", () => {
    expect(
      splitWalletBalance([
        wallet({
          balance: { value: "10.00", currency: "THB" },
          archivedAt: "2026-09-10T00:00:00Z",
        }),
        wallet({
          id: "wallet-2",
          savings: true,
          balance: { value: "20.00", currency: "THB" },
          archivedAt: "2026-09-10T00:00:00Z",
        }),
      ]),
    ).toEqual({
      total: { value: "30.00", currency: "THB" },
      spendable: { value: "10.00", currency: "THB" },
      setAside: { value: "20.00", currency: "THB" },
    });
  });

  test("keeps negative spendable and savings balances as they are", () => {
    expect(
      splitWalletBalance([
        wallet({ balance: { value: "-5.10", currency: "THB" } }),
        wallet({
          id: "wallet-2",
          savings: true,
          balance: { value: "-10.20", currency: "THB" },
        }),
      ]),
    ).toEqual({
      total: { value: "-15.30", currency: "THB" },
      spendable: { value: "-5.10", currency: "THB" },
      setAside: { value: "-10.20", currency: "THB" },
    });
  });

  test("has zero spendable when every wallet is a savings wallet", () => {
    expect(
      splitWalletBalance([
        wallet({ savings: true, balance: { value: "0.00", currency: "THB" } }),
        wallet({
          id: "wallet-2",
          savings: true,
          balance: { value: "20.00", currency: "THB" },
        }),
      ]),
    ).toEqual({
      total: { value: "20.00", currency: "THB" },
      spendable: { value: "0.00", currency: "THB" },
      setAside: { value: "20.00", currency: "THB" },
    });
  });
});
