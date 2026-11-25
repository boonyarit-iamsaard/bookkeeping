import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { apiClient } from "@/core/api/client";
import { formatApiMoneyInput, presentApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import { walletQueries } from "@/core/api/queries";
import { useFormWrites } from "@/core/api/use-form-writes";
import { createWalletFormSchema } from "@/features/wallets/wallet-form-schema";
import { WALLET_REFUSAL_WORDING } from "@/features/wallets/wallet-rejection";
import { useToday } from "@/shared/hooks/use-today";

type Wallet = components["schemas"]["Wallet"];
type WalletOpeningRequest = components["schemas"]["WalletOpeningRequest"];
type WalletStateRequest = components["schemas"]["WalletStateRequest"];
type ChangeSource = "savings" | "other";

const NO_OUTCOME = { error: "", notice: "" };

export function useWalletManagement(wallet: Readonly<Wallet>) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState(() =>
    formatApiMoneyInput(wallet.openingAmount),
  );
  const [date, setDate] = useState(wallet.openingDate);
  const today = useToday();
  const openingSchema = useMemo(
    () =>
      createWalletFormSchema({ today }).pick({
        openingAmount: true,
        openingDate: true,
      }),
    [today],
  );
  // The opening card checks its values before any write starts.
  const [invalidOpening, setInvalidOpening] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [changeSource, setChangeSource] = useState<ChangeSource>("other");

  function sendState(input: WalletStateRequest) {
    return apiClient.PATCH("/v1/wallets/{walletId}", {
      params: { path: { walletId: wallet.id } },
      body: input,
    });
  }
  const { submit, pending, isRunning, serverError } = useFormWrites({
    fields: [],
    writes: {
      opening: {
        kind: "change",
        send: (input: WalletOpeningRequest) =>
          apiClient.PUT("/v1/wallets/{walletId}/opening", {
            params: { path: { walletId: wallet.id } },
            body: input,
          }),
        ...WALLET_REFUSAL_WORDING,
        onDone: () => setNotice("Opening balance corrected."),
      },
      archive: {
        kind: "change",
        send: sendState,
        ...WALLET_REFUSAL_WORDING,
        onDone: (changed: Wallet) =>
          setNotice(
            changed.archivedAt
              ? "Wallet archived. Its balance remains in your totals."
              : "Wallet unarchived. You can use it for new entries.",
          ),
      },
      savings: {
        kind: "change",
        send: sendState,
        ...WALLET_REFUSAL_WORDING,
        onDone: (changed: Wallet) =>
          setNotice(
            changed.savings
              ? "Marked as a Savings wallet. Its balance now counts in Set aside."
              : "No longer a Savings wallet. Its balance now counts in Spendable.",
          ),
      },
      remove: {
        kind: "delete",
        send: () =>
          apiClient.DELETE("/v1/wallets/{walletId}", {
            params: { path: { walletId: wallet.id } },
          }),
        ...WALLET_REFUSAL_WORDING,
        retired: [walletQueries.detail(wallet.id).queryKey],
        onDone: () => navigate({ to: "/wallets" }),
      },
    },
  });

  const error = invalidOpening || serverError || "";
  // A change reads back in the card that made it, not in both.
  const pageOutcome = changeSource === "other" ? { error, notice } : NO_OUTCOME;
  const savingsOutcome =
    changeSource === "savings" ? { error, notice } : NO_OUTCOME;

  function beginChange(source: ChangeSource = "other") {
    setChangeSource(source);
    setInvalidOpening("");
    setNotice("");
  }

  async function submitOpening() {
    beginChange();
    const parsed = openingSchema.safeParse({
      openingAmount: amount,
      openingDate: date,
    });
    if (!parsed.success) {
      setInvalidOpening(
        parsed.error.issues.map((issue) => issue.message).join(". "),
      );
      return;
    }

    await submit("opening", {
      amount: presentApiMoney({
        amountInMinorUnits: parsed.data.openingAmount,
        currency: "THB",
      }),
      date: parsed.data.openingDate,
    });
  }

  async function submitArchiveState() {
    if (pending) {
      return;
    }
    beginChange();
    await submit("archive", { archived: !archived });
  }

  async function submitSavingsState() {
    if (pending) {
      return;
    }
    beginChange("savings");
    await submit("savings", { savings: !wallet.savings });
  }

  async function submitDelete() {
    beginChange();
    await submit("remove");
  }

  const archived = Boolean(wallet.archivedAt);

  return {
    amount,
    setAmount,
    date,
    setDate,
    today,
    pending,
    archived,
    pageOutcome,
    savingsOutcome,
    changeSource,
    confirmDelete,
    setConfirmDelete,
    savingSavings: isRunning("savings"),
    submitOpening,
    submitArchiveState,
    submitSavingsState,
    submitDelete,
  };
}
