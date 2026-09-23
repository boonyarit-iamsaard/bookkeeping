import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { formatMoneyInput } from "@bookkeeping/domain/money";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { formatApiMoneyInput } from "@/core/api/api-money";
import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import { walletQueries } from "@/core/api/queries";
import { useApiMutation } from "@/core/api/use-api-mutation";
import type { ApiFieldError, ApiRejection } from "@/core/api/write-submission";
import {
  forgetReads,
  refreshAfterWrite,
} from "@/core/query/refresh-after-write";
import { walletFormSchema } from "@/features/wallets/wallet-form-schema";
import { DatePicker } from "@/shared/components/date-picker";
import { Money } from "@/shared/components/money";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

type Wallet = components["schemas"]["Wallet"];
type WalletOpeningRequest = components["schemas"]["WalletOpeningRequest"];
type WalletArchiveStateRequest =
  components["schemas"]["WalletArchiveStateRequest"];

interface WalletManagementProps {
  wallet: Wallet;
}

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

function describeWalletRejection(rejection: Readonly<ApiRejection>): string {
  const fieldError = Object.values(rejection.fieldErrors)[0];
  return (
    fieldError ??
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

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Wallet balance">
        <p className="text-muted-foreground text-sm">
          Current balance{wallet.archivedAt ? " · Archived" : ""}
        </p>
        <Money amount={wallet.balance} className="text-3xl" />
      </section>
      {error && (
        <p id="wallet-error" role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {notice && <output className="block text-sm">{notice}</output>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitOpening();
        }}
        aria-describedby={error ? "wallet-error" : undefined}
        className="flex flex-col gap-5"
      >
        <div>
          <h2 className="font-semibold text-lg">Correct opening balance</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Correct the amount held when tracking began. This changes balances,
            with a retained internal history.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="opening-amount">Opening balance (THB)</Label>
          <Input
            id="opening-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={pending}
            className="money min-h-12"
            required
          />
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
            className="h-12"
          />
        </div>
        <Button type="submit" size="lg" className="min-h-12" disabled={pending}>
          {pending ? "Saving…" : "Save opening correction"}
        </Button>
      </form>
      <section
        className="flex flex-col items-start gap-3 border-t pt-6"
        aria-labelledby="archive-heading"
      >
        <h2 id="archive-heading" className="font-semibold text-lg">
          {wallet.archivedAt ? "Unarchive wallet" : "Archive wallet"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {wallet.archivedAt
            ? "Restore this wallet to new-entry pickers. Its history and balance stay the same."
            : "Remove this wallet from new-entry pickers at any balance. Existing entries stay editable and its money stays in your totals."}
        </p>
        <Button
          variant="outline"
          size="lg"
          className="min-h-12"
          disabled={pending}
          onClick={() => void submitArchiveState(!wallet.archivedAt)}
        >
          {wallet.archivedAt ? "Unarchive wallet" : "Archive wallet"}
        </Button>
      </section>
      <section
        className="flex flex-col items-start gap-3 border-t pt-6"
        aria-labelledby="delete-heading"
      >
        <h2 id="delete-heading" className="font-semibold text-lg">
          Permanent deletion
        </h2>
        <p className="text-muted-foreground text-sm">
          Only wallets without transactions or retained change history can be
          deleted. A zero balance is insufficient.
        </p>
        {confirmDelete ? (
          <>
            <p className="text-sm">
              Delete this wallet permanently? Its opening balance will leave
              your totals. This cannot be undone.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="destructive"
                size="lg"
                className="min-h-12"
                disabled={pending}
                onClick={() => void submitDelete()}
              >
                Delete permanently
              </Button>
              <Button
                variant="outline"
                className="min-h-12"
                disabled={pending}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <Button
            variant="outline"
            size="lg"
            className="min-h-12"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
          >
            Delete wallet…
          </Button>
        )}
      </section>
    </div>
  );
}
