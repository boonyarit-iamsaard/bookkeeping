import { formatMoneyInput } from "@bookkeeping/domain/money";
import type { ApiMoney } from "@/core/api/money";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";

type WalletSummary = components["schemas"]["Wallet"];

interface WalletBalanceSplit {
  total: ApiMoney;
  spendable: ApiMoney;
  setAside: ApiMoney;
}

/** The balance across the given wallets, archived ones included, in THB. */
export function totalWalletBalance(
  wallets: readonly WalletSummary[],
): ApiMoney {
  return moneyFromMinorUnits(wallets.reduce(addWalletBalance, 0n));
}

/** Spendable and set-aside balances in THB, or no split without Savings wallets. */
export function splitWalletBalance(
  wallets: readonly WalletSummary[],
): WalletBalanceSplit | null {
  let spendable = 0n;
  let setAside = 0n;
  let hasSavings = false;

  for (const wallet of wallets) {
    if (wallet.savings) {
      hasSavings = true;
      setAside = addWalletBalance(setAside, wallet);
    } else {
      spendable = addWalletBalance(spendable, wallet);
    }
  }

  if (!hasSavings) {
    return null;
  }

  return {
    total: moneyFromMinorUnits(spendable + setAside),
    spendable: moneyFromMinorUnits(spendable),
    setAside: moneyFromMinorUnits(setAside),
  };
}

function addWalletBalance(total: bigint, wallet: Readonly<WalletSummary>) {
  return total + parseApiMoney(wallet.balance);
}

function moneyFromMinorUnits(amountInMinorUnits: bigint): ApiMoney {
  return {
    value: formatMoneyInput({ amountInMinorUnits, currency: "THB" }),
    currency: "THB",
  };
}
