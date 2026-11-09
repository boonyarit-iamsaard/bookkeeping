import { describe, expect, test } from "vitest";
import { summarizeWalletBalance, walletClosingBalance } from "./wallet-balance";

describe("walletClosingBalance", () => {
  const wallet = {
    openingAmount: 10_000n,
    openingDate: "2026-09-10",
    movement: -2_500n,
  } as const;

  test("a wallet has no Closing balance before its opening date", () => {
    expect(walletClosingBalance(wallet, "2026-09-09")).toBeNull();
  });

  test("on and after its opening date it is the opening plus the movement", () => {
    expect(walletClosingBalance(wallet, "2026-09-10")).toBe(7_500n);
    expect(walletClosingBalance(wallet, "2026-10-01")).toBe(7_500n);
  });
});

describe("summarizeWalletBalance", () => {
  test("splits the signed Total balance into Spendable and Set aside", () => {
    expect(
      summarizeWalletBalance([
        { savings: false, balance: 12_000n },
        { savings: false, balance: -3_000n },
        { savings: true, balance: 50_000n },
        { savings: true, balance: -500n },
      ]),
    ).toEqual({
      total: 58_500n,
      spendable: 9_000n,
      setAside: 49_500n,
      walletCount: 4,
      spendableWalletCount: 2,
      savingsWalletCount: 2,
    });
  });

  test("leaves out unopened Wallets, and a kind with no opened Wallet has no figure", () => {
    expect(
      summarizeWalletBalance([
        { savings: false, balance: 0n },
        { savings: false, balance: null },
        { savings: true, balance: null },
      ]),
    ).toEqual({
      total: 0n,
      spendable: 0n,
      setAside: null,
      walletCount: 1,
      spendableWalletCount: 1,
      savingsWalletCount: 0,
    });
    expect(
      summarizeWalletBalance([{ savings: true, balance: -200n }]),
    ).toMatchObject({ total: -200n, spendable: null, setAside: -200n });
  });

  test("has no Total balance before any Wallet opened", () => {
    expect(summarizeWalletBalance([{ savings: false, balance: null }])).toEqual(
      {
        total: null,
        spendable: null,
        setAside: null,
        walletCount: 0,
        spendableWalletCount: 0,
        savingsWalletCount: 0,
      },
    );
  });
});
