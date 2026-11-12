import { useNavigate } from "@tanstack/react-router";
import { Archive, ArchiveRestore, PiggyBank, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { apiClient } from "@/core/api/client";
import { formatApiMoneyInput, presentApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import { walletQueries } from "@/core/api/queries";
import { useFormWrites } from "@/core/api/use-form-writes";
import { WalletTile } from "@/features/wallets/components/wallet-tile";
import { createWalletFormSchema } from "@/features/wallets/wallet-form-schema";
import { WALLET_REFUSAL_WORDING } from "@/features/wallets/wallet-rejection";
import { ConfirmPanel } from "@/shared/components/confirm-panel";
import { DatePicker } from "@/shared/components/date-picker";
import { ErrorNotice } from "@/shared/components/error-notice";
import { Money } from "@/shared/components/money";
import { SavedNotice } from "@/shared/components/saved-notice";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/helpers/cn";
import { useToday } from "@/shared/hooks/use-today";

type Wallet = components["schemas"]["Wallet"];
type WalletOpeningRequest = components["schemas"]["WalletOpeningRequest"];
type WalletStateRequest = components["schemas"]["WalletStateRequest"];
type ChangeSource = "savings" | "other";

interface WalletManagementProps {
  wallet: Wallet;
}

const NO_OUTCOME = { error: "", notice: "" };

/** Each management task is its own card on the ground. */
const manageCardClass =
  "flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card sm:p-7";

export function WalletManagement({ wallet }: Readonly<WalletManagementProps>) {
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

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <section
        aria-label="Wallet balance"
        className={cn(manageCardClass, "flex-row items-center gap-3.5")}
      >
        <WalletTile type={wallet.type} archived={archived} />
        <div className="flex min-w-0 flex-col">
          {/* The phone title bar truncates; say which wallet this is in full. */}
          <p className="text-sm font-medium wrap-break-word sm:hidden">
            {wallet.name}
          </p>
          <p className="text-muted-foreground text-sm">
            Current balance{wallet.savings ? " · Savings" : ""}
            {archived ? " · Archived" : ""}
          </p>
          <Money
            amount={wallet.balance}
            className="text-xl leading-snug font-bold"
          />
        </div>
      </section>
      {pageOutcome.error && (
        <div id="wallet-error">
          <ErrorNotice>{pageOutcome.error}</ErrorNotice>
        </div>
      )}
      {changeSource === "other" && (
        <SavedNotice className={cn(!pageOutcome.notice && "sr-only")}>
          {pageOutcome.notice}
        </SavedNotice>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitOpening();
        }}
        aria-describedby={pageOutcome.error ? "wallet-error" : undefined}
        className={cn(manageCardClass, "gap-5")}
      >
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-bold tracking-tight">
            Correct opening balance
          </h2>
          <p className="text-muted-foreground text-sm leading-normal">
            Correct the amount held when tracking began. This changes balances,
            with a retained internal history.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="opening-amount">Opening balance (THB)</Label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="money text-muted-foreground pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg"
            >
              ฿
            </span>
            <Input
              id="opening-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={pending}
              className="money text-foreground h-12 pl-9 text-lg sm:h-12 md:text-lg"
              required
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="opening-date">Opening date</Label>
          <DatePicker
            id="opening-date"
            today={today}
            max={today}
            value={date}
            onChange={setDate}
            disabled={pending}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-base sm:h-10 sm:w-auto sm:self-start sm:text-sm"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save opening correction"}
        </Button>
      </form>
      <section aria-labelledby="savings-heading" className={manageCardClass}>
        <div className="flex flex-col gap-1.5">
          <h2 id="savings-heading" className="text-lg font-bold tracking-tight">
            Savings wallet
          </h2>
          <p
            id="savings-description"
            className="text-muted-foreground text-sm leading-normal"
          >
            {wallet.savings
              ? "This is a Savings wallet. Its balance counts in Set aside."
              : "This is not a Savings wallet. Its balance counts in Spendable."}{" "}
            Its type, balance and transactions stay the same.
          </p>
        </div>
        <Button
          variant="outline"
          size="lg"
          className="h-auto min-h-11 max-w-full self-start py-2.5 text-left whitespace-normal aria-disabled:pointer-events-none aria-disabled:opacity-50 sm:h-auto sm:min-h-10 sm:py-2"
          aria-describedby="savings-description"
          aria-disabled={pending}
          onClick={() => void submitSavingsState()}
        >
          <PiggyBank data-icon="inline-start" strokeWidth={1.75} />
          {savingsButtonLabel({
            pending: isRunning("savings"),
            savings: wallet.savings,
          })}
        </Button>
        {savingsOutcome.error && (
          <ErrorNotice>{savingsOutcome.error}</ErrorNotice>
        )}
        {changeSource === "savings" && (
          <SavedNotice className={cn(!savingsOutcome.notice && "sr-only")}>
            {savingsOutcome.notice}
          </SavedNotice>
        )}
      </section>
      <section aria-labelledby="archive-heading" className={manageCardClass}>
        <div className="flex flex-col gap-1.5">
          <h2 id="archive-heading" className="text-lg font-bold tracking-tight">
            {archived ? "Unarchive wallet" : "Archive wallet"}
          </h2>
          <p className="text-muted-foreground text-sm leading-normal">
            {archived
              ? "Restore this wallet to new-entry pickers. Its history and balance stay the same."
              : "Remove this wallet from new-entry pickers at any balance. Existing entries stay editable and its money stays in your totals."}
          </p>
        </div>
        <Button
          variant="outline"
          size="lg"
          className="self-start aria-disabled:pointer-events-none aria-disabled:opacity-50"
          aria-disabled={pending}
          onClick={() => void submitArchiveState()}
        >
          {archived ? (
            <ArchiveRestore data-icon="inline-start" strokeWidth={1.75} />
          ) : (
            <Archive data-icon="inline-start" strokeWidth={1.75} />
          )}
          {archived ? "Unarchive wallet" : "Archive wallet"}
        </Button>
      </section>
      {/* Deletion stands apart by space and its pictogram, not color alone. */}
      <section
        aria-labelledby="delete-heading"
        className={cn(manageCardClass, "mt-4 sm:mt-6")}
      >
        <div className="flex flex-col gap-1.5">
          <h2 id="delete-heading" className="text-lg font-bold tracking-tight">
            Permanent deletion
          </h2>
          <p className="text-muted-foreground text-sm leading-normal">
            Only wallets without transactions or retained change history can be
            deleted. A zero balance is insufficient.
          </p>
        </div>
        {confirmDelete ? (
          <ConfirmPanel
            actions={
              <>
                <Button
                  variant="destructive"
                  size="lg"
                  disabled={pending}
                  onClick={() => void submitDelete()}
                >
                  <Trash2 data-icon="inline-start" strokeWidth={1.75} />
                  Delete permanently
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  disabled={pending}
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </>
            }
          >
            Delete this wallet permanently? Its opening balance will leave your
            totals. This cannot be undone.
          </ConfirmPanel>
        ) : (
          <Button
            variant="destructive"
            size="lg"
            className="self-start"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 data-icon="inline-start" strokeWidth={1.75} />
            Delete wallet…
          </Button>
        )}
      </section>
    </div>
  );
}

interface SavingsButtonState {
  pending: boolean;
  savings: boolean;
}

function savingsButtonLabel({
  pending,
  savings,
}: Readonly<SavingsButtonState>) {
  if (pending) {
    return "Saving…";
  }
  return savings ? "Unmark as a Savings wallet" : "Mark as a Savings wallet";
}
