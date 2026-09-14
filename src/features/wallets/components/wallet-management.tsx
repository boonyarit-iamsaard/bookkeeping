"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Money } from "@/features/wallets/components/money";
import { manageWalletAction } from "@/features/wallets/server/wallet.actions";
import { walletFormSchema } from "@/features/wallets/wallet-form-schema";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { APP_TIME_ZONE, todayIn } from "@/shared/helpers/dates";

interface WalletManagementProps {
  id: string;
  archived: boolean;
  balance: bigint;
  openingAmount: string;
  openingDate: string;
}
const ERROR_MESSAGES = {
  "wallet-not-found": "This wallet is no longer available. Return to Wallets.",
  "invalid-opening":
    "Enter a valid opening amount and a date on or before today.",
  "movement-before-opening":
    "Opening date cannot be after an existing movement, including retained deleted entries. Choose an earlier date.",
  "history-remains":
    "This wallet has retained transaction or change history and cannot be deleted. Archive it to remove it from entry pickers.",
  unauthenticated: "Sign in again to manage this wallet.",
  invalid: "Check the amount and date and try again.",
};
export function WalletManagement(props: Readonly<WalletManagementProps>) {
  const router = useRouter();
  const [amount, setAmount] = useState(props.openingAmount);
  const [date, setDate] = useState(props.openingDate);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  function submit(operation: "opening" | "archive" | "unarchive" | "delete") {
    setError("");
    setNotice("");
    if (operation === "opening") {
      const parsed = walletFormSchema
        .pick({ openingAmount: true, openingDate: true })
        .safeParse({ openingAmount: amount, openingDate: date });
      if (!parsed.success) {
        setError(parsed.error.issues.map((issue) => issue.message).join(". "));
        return;
      }
    }
    startTransition(async () => {
      try {
        const result = await manageWalletAction({
          id: props.id,
          operation,
          opening: { openingAmount: amount, openingDate: date },
        });
        if (!result.ok) {
          setError(ERROR_MESSAGES[result.error]);
          return;
        }
        if (operation === "delete") {
          router.push("/wallets");
          return;
        }
        setNotice(
          operation === "opening"
            ? "Opening balance corrected."
            : operation === "archive"
              ? "Wallet archived. Its balance remains in your totals."
              : "Wallet unarchived. You can use it for new entries.",
        );
      } catch {
        setError(
          "The change could not be confirmed. Your values are kept; try again.",
        );
      }
    });
  }
  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Wallet balance">
        <p className="text-muted-foreground text-sm">
          Current balance{props.archived ? " · Archived" : ""}
        </p>
        <Money
          amountInMinorUnits={props.balance}
          currency="THB"
          className="text-3xl"
        />
      </section>
      {error && (
        <p id="wallet-error" role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit("opening");
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
          <Input
            id="opening-date"
            className="min-h-12"
            type="date"
            value={date}
            max={todayIn({ timeZone: APP_TIME_ZONE })}
            onChange={(event) => setDate(event.target.value)}
            disabled={pending}
            required
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
          {props.archived ? "Unarchive wallet" : "Archive wallet"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {props.archived
            ? "Restore this wallet to new-entry pickers. Its history and balance stay the same."
            : "Remove this wallet from new-entry pickers at any balance. Existing entries stay editable and its money stays in your totals."}
        </p>
        <Button
          variant="outline"
          size="lg"
          className="min-h-12"
          disabled={pending}
          onClick={() => submit(props.archived ? "unarchive" : "archive")}
        >
          {props.archived ? "Unarchive wallet" : "Archive wallet"}
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
                onClick={() => submit("delete")}
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
