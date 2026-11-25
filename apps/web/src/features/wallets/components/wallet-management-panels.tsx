import { Archive, ArchiveRestore, PiggyBank, Trash2 } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { WalletTile } from "@/features/wallets/components/wallet-tile";
import type { useWalletManagement } from "@/features/wallets/hooks/use-wallet-management";
import { ConfirmPanel } from "@/shared/components/confirm-panel";
import { DatePicker } from "@/shared/components/date-picker";
import { ErrorNotice } from "@/shared/components/error-notice";
import { Money } from "@/shared/components/money";
import { SavedNotice } from "@/shared/components/saved-notice";
import { Skeleton } from "@/shared/components/skeleton";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/helpers/cn";

type Management = ReturnType<typeof useWalletManagement>;

interface WalletManagementPanelProps {
  management: Management;
}

interface WalletManagementBalanceProps {
  wallet: components["schemas"]["Wallet"];
  nameLine?: React.ReactNode;
}

interface WalletSavingsPanelProps extends WalletManagementPanelProps {
  savings: boolean;
}

interface WalletDeletionPanelProps extends WalletManagementPanelProps {
  className?: string;
}

/** Each management task is its own card on the ground. */
const manageCardClass =
  "flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card sm:p-7 *:max-w-md";

function savingsButtonLabel({
  pending,
  savings,
}: Readonly<SavingsButtonState>) {
  if (pending) {
    return "Saving…";
  }
  return savings ? "Unmark as a Savings wallet" : "Mark as a Savings wallet";
}

export function WalletManagementBalance({
  wallet,
  nameLine,
}: Readonly<WalletManagementBalanceProps>) {
  const archived = Boolean(wallet.archivedAt);
  return (
    <section
      aria-label="Wallet balance"
      className={cn(manageCardClass, "flex-row items-center gap-3.5")}
    >
      <WalletTile type={wallet.type} archived={archived} />
      <div className="flex min-w-0 flex-col">
        {nameLine}
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
  );
}

export function WalletManagementNotice({
  management,
}: Readonly<WalletManagementPanelProps>) {
  const { pageOutcome, changeSource } = management;
  return (
    <>
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
    </>
  );
}

export function WalletOpeningPanel({
  management,
}: Readonly<WalletManagementPanelProps>) {
  const {
    pageOutcome,
    pending,
    amount,
    setAmount,
    date,
    setDate,
    today,
    submitOpening,
  } = management;
  return (
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
  );
}

export function WalletSavingsPanel({
  management,
  savings,
}: Readonly<WalletSavingsPanelProps>) {
  const {
    pending,
    savingSavings,
    savingsOutcome,
    changeSource,
    submitSavingsState,
  } = management;
  return (
    <section aria-labelledby="savings-heading" className={manageCardClass}>
      <div className="flex flex-col gap-1.5">
        <h2 id="savings-heading" className="text-lg font-bold tracking-tight">
          Savings wallet
        </h2>
        <p
          id="savings-description"
          className="text-muted-foreground text-sm leading-normal"
        >
          {savings
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
          pending: savingSavings,
          savings: savings,
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
  );
}

export function WalletArchivePanel({
  management,
}: Readonly<WalletManagementPanelProps>) {
  const { archived, pending, submitArchiveState } = management;
  return (
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
  );
}

export function WalletDeletionPanel({
  management,
  className,
}: Readonly<WalletDeletionPanelProps>) {
  const { confirmDelete, setConfirmDelete, pending, submitDelete } = management;
  return (
    <section
      aria-labelledby="delete-heading"
      className={cn(manageCardClass, className)}
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
  );
}

interface SavingsButtonState {
  pending: boolean;
  savings: boolean;
}

interface WalletManagementPanelSkeletonProps {
  className: string;
}

export function WalletManagementPanelSkeleton({
  className,
}: Readonly<WalletManagementPanelSkeletonProps>) {
  return (
    <div className={manageCardClass}>
      <Skeleton className="h-6 w-44" />
      <Skeleton className={className} />
    </div>
  );
}
