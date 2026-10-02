import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { formatMoneyInput } from "@bookkeeping/domain/money";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useState } from "react";
import { apiClient } from "@/core/api/client";
import { formatApiMoneyInput } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import { walletQueries } from "@/core/api/queries";
import { useApiMutation } from "@/core/api/use-api-mutation";
import type { ApiFieldError, ApiRejection } from "@/core/api/write-submission";
import {
  forgetReads,
  refreshAfterWrite,
} from "@/core/query/refresh-after-write";
import { WalletTile } from "@/features/wallets/components/wallet-tile";
import { walletFormSchema } from "@/features/wallets/wallet-form-schema";
import { ConfirmPanel } from "@/shared/components/confirm-panel";
import { DatePicker } from "@/shared/components/date-picker";
import { ErrorNotice } from "@/shared/components/error-notice";
import { Money } from "@/shared/components/money";
import { SavedNotice } from "@/shared/components/saved-notice";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/helpers/cn";

type Wallet = components["schemas"]["Wallet"];
type WalletOpeningRequest = components["schemas"]["WalletOpeningRequest"];
type WalletArchiveStateRequest =
  components["schemas"]["WalletArchiveStateRequest"];

interface WalletManagementProps {
  wallet: Wallet;
}

/** Each management task is its own card on the ground. */
const manageCardClass =
  "flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card sm:p-7";

const ERROR_MESSAGES: Record<string, string> = {
  "wallet-not-found": "This wallet is no longer available. Return to Wallets.",
  "not-found": "This wallet is no longer available. Return to Wallets.",
  "invalid-opening":
    "Enter a valid opening amount and a date on or before today.",
  "movement-before-opening":
    "Opening date cannot be after an existing movement, including retained deleted entries. Choose an earlier date.",
  "history-remains":
    "This wallet has retained transaction or change history and cannot be deleted. Archive it to remove it from entry pickers.",
  unauthenticated: "Sign in again to manage this wallet.",
};

const FIELD_ERROR_MESSAGES: Record<string, string> = {
  "invalid-format": "Check the amount and date and try again.",
  "in-future": "Opening date cannot be in the future.",
  "movement-before-opening":
    "Opening date cannot be after an existing movement, including retained deleted entries. Choose an earlier date.",
};

function describeWalletFieldError({
  code,
  detail,
}: Readonly<ApiFieldError>): string {
  return (
    detail ??
    FIELD_ERROR_MESSAGES[code] ??
    "Check the amount and date and try again."
  );
}

// These writes show no fields, so a field error arrives as the message.
function describeWalletRejection(rejection: Readonly<ApiRejection>): string {
  return (
    ERROR_MESSAGES[rejection.problem.code] ??
    rejection.message ??
    "The change could not be confirmed. Your values are kept; try again."
  );
}

export function WalletManagement({ wallet }: Readonly<WalletManagementProps>) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(() =>
    formatApiMoneyInput(wallet.openingAmount),
  );
  const [date, setDate] = useState(wallet.openingDate);
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openingMutation = useApiMutation<WalletOpeningRequest, Wallet>({
    send: (input) =>
      apiClient.PUT("/v1/wallets/{walletId}/opening", {
        params: { path: { walletId: wallet.id } },
        body: input,
      }),
    describeFieldError: describeWalletFieldError,
  });
  const archiveMutation = useApiMutation<WalletArchiveStateRequest, Wallet>({
    send: (input) =>
      apiClient.PATCH("/v1/wallets/{walletId}", {
        params: { path: { walletId: wallet.id } },
        body: input,
      }),
    describeFieldError: describeWalletFieldError,
  });
  const deleteMutation = useApiMutation<undefined, unknown>({
    send: () =>
      apiClient.DELETE("/v1/wallets/{walletId}", {
        params: { path: { walletId: wallet.id } },
      }),
  });
  const pending =
    openingMutation.isPending ||
    archiveMutation.isPending ||
    deleteMutation.isPending;

  function beginChange() {
    setError("");
    setNotice("");
  }

  async function refreshAfterChange(message: string) {
    await refreshAfterWrite(queryClient);
    setNotice(message);
  }

  async function submitOpening() {
    beginChange();
    const parsed = walletFormSchema
      .pick({ openingAmount: true, openingDate: true })
      .safeParse({ openingAmount: amount, openingDate: date });
    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(". "));
      return;
    }

    let result: Awaited<ReturnType<typeof openingMutation.submit>>;
    try {
      result = await openingMutation.submit({
        amount: {
          value: formatMoneyInput({
            amountInMinorUnits: parsed.data.openingAmount,
            currency: "THB",
          }),
          currency: "THB",
        },
        date: parsed.data.openingDate,
      });
    } catch {
      setError(
        "The change could not be confirmed. Your values are kept; try again.",
      );
      return;
    }
    if (!result.ok) {
      setError(describeWalletRejection(result.error));
      return;
    }
    await refreshAfterChange("Opening balance corrected.");
  }

  async function submitArchiveState(archived: boolean) {
    beginChange();
    let result: Awaited<ReturnType<typeof archiveMutation.submit>>;
    try {
      result = await archiveMutation.submit({ archived });
    } catch {
      setError(
        "The change could not be confirmed. Your values are kept; try again.",
      );
      return;
    }
    if (!result.ok) {
      setError(describeWalletRejection(result.error));
      return;
    }
    await refreshAfterChange(
      archived
        ? "Wallet archived. Its balance remains in your totals."
        : "Wallet unarchived. You can use it for new entries.",
    );
  }

  async function submitDelete() {
    beginChange();
    let result: Awaited<ReturnType<typeof deleteMutation.submit>>;
    try {
      result = await deleteMutation.submit(undefined);
    } catch {
      setError(
        "The change could not be confirmed. Your values are kept; try again.",
      );
      return;
    }
    if (!result.ok) {
      setError(describeWalletRejection(result.error));
      return;
    }
    const retired = [walletQueries.detail(wallet.id).queryKey];
    await refreshAfterWrite(queryClient, { retired });
    await navigate({ to: "/wallets" });
    forgetReads(queryClient, retired);
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
          <p className="text-muted-foreground text-sm">
            Current balance{archived ? " · Archived" : ""}
          </p>
          <Money
            amount={wallet.balance}
            className="font-bold text-xl leading-snug"
          />
        </div>
      </section>
      {error && (
        <div id="wallet-error">
          <ErrorNotice>{error}</ErrorNotice>
        </div>
      )}
      {notice && <SavedNotice>{notice}</SavedNotice>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitOpening();
        }}
        aria-describedby={error ? "wallet-error" : undefined}
        className={cn(manageCardClass, "gap-5")}
      >
        <div className="flex flex-col gap-1.5">
          <h2 className="font-bold text-lg tracking-tight">
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
              className="money pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg text-muted-foreground"
            >
              ฿
            </span>
            <Input
              id="opening-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={pending}
              className="money h-12 pl-9 text-foreground text-lg sm:h-12 md:text-lg"
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
      <section aria-labelledby="archive-heading" className={manageCardClass}>
        <div className="flex flex-col gap-1.5">
          <h2 id="archive-heading" className="font-bold text-lg tracking-tight">
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
          className="self-start"
          disabled={pending}
          onClick={() => void submitArchiveState(!archived)}
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
          <h2 id="delete-heading" className="font-bold text-lg tracking-tight">
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
