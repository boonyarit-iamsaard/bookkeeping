"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Trash2 } from "lucide-react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useState } from "react";
import { deleteTransactionAction } from "@/features/transactions/server/transaction.actions";
import type { TransactionType } from "@/features/transactions/transaction.types";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_SIGNS,
} from "@/features/transactions/transaction.types";
import { Button } from "@/shared/components/ui/button";
import type { CalendarDate } from "@/shared/helpers/dates";
import { formatCalendarDate } from "@/shared/helpers/dates";
import { formatMoney, parseMoneyInput } from "@/shared/helpers/money";

interface DeleteTransactionButtonProps {
  transaction: {
    id: string;
    type: TransactionType;
    amountText: string;
    transactionDate: CalendarDate;
  };
  walletName: string | undefined;
  destinationWalletName?: string;
  disabled?: boolean;
}

type State =
  | { name: "idle" }
  | { name: "deleting" }
  | { name: "failed"; message: string };

const LOST_RESPONSE =
  "The deletion could not be confirmed. Check your connection and try again; deleting twice is harmless.";

/**
 * The destructive action of the edit screen: a button that opens a
 * confirmation reading the line back, then deletes and returns to the list
 * with a notice. Repeating a deletion whose response was lost is safe.
 */
export function DeleteTransactionButton({
  transaction,
  walletName,
  destinationWalletName,
  disabled,
}: Readonly<DeleteTransactionButtonProps>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ name: "idle" });
  const parsed = parseMoneyInput({
    text: transaction.amountText,
    currency: "THB",
  });
  const figure = parsed.ok
    ? `${TRANSACTION_TYPE_SIGNS[transaction.type]}${formatMoney({
        amountInMinorUnits: parsed.value,
        currency: "THB",
      })}`
    : undefined;
  const noun = TRANSACTION_TYPE_LABELS[transaction.type].toLowerCase();

  async function confirm() {
    setState({ name: "deleting" });
    let result: Awaited<ReturnType<typeof deleteTransactionAction>>;
    try {
      result = await deleteTransactionAction({ id: transaction.id });
    } catch (error) {
      unstable_rethrow(error);
      setState({ name: "failed", message: LOST_RESPONSE });
      return;
    }
    if (!result.ok) {
      if (result.error.code === "unauthenticated") {
        router.push("/sign-in");
        return;
      }
      // Already gone: the goal state holds, so report it as done.
      router.push("/transactions?deleted=1");
      router.refresh();
    }
  }

  const deleting = state.name === "deleting";

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (deleting) {
          return;
        }
        setOpen(next);
        if (next) {
          setState({ name: "idle" });
        }
      }}
    >
      <AlertDialog.Trigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="destructive"
            size="lg"
            className="h-11 self-start"
          />
        }
      >
        <Trash2 data-icon="inline-start" strokeWidth={1.75} />
        Delete {noun}
      </AlertDialog.Trigger>

      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <AlertDialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <AlertDialog.Popup className="flex w-full flex-col gap-6 rounded-t-xl bg-background px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-foreground outline-none transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] data-ending-style:translate-y-full data-starting-style:translate-y-full motion-reduce:transition-none sm:max-w-md sm:rounded-xl sm:border sm:pb-6 sm:duration-200 sm:data-ending-style:translate-y-2 sm:data-starting-style:translate-y-2 sm:data-ending-style:scale-[0.98] sm:data-starting-style:scale-[0.98] sm:data-ending-style:opacity-0 sm:data-starting-style:opacity-0">
            <div className="flex flex-col gap-2">
              <AlertDialog.Title className="font-semibold text-lg">
                Delete this {noun}?
              </AlertDialog.Title>
              <AlertDialog.Description className="text-muted-foreground text-sm leading-normal">
                {figure && (
                  <>
                    <span className="money font-medium text-foreground">
                      {figure}
                    </span>
                    {walletName && ` · ${walletName}`}
                    {destinationWalletName && ` → ${destinationWalletName}`} on{" "}
                    {formatCalendarDate(transaction.transactionDate)}{" "}
                  </>
                )}
                {transaction.type === "transfer"
                  ? "will leave the list and both wallet balances."
                  : "will leave the list and the wallet balance."}{" "}
                This can't be undone.
              </AlertDialog.Description>
            </div>
            {state.name === "failed" && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm"
              >
                {state.message}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <Button
                type="button"
                variant="destructive"
                size="lg"
                disabled={deleting}
                onClick={confirm}
                className="h-12 w-full text-base sm:h-11 sm:w-auto sm:text-sm"
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
              <AlertDialog.Close
                disabled={deleting}
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="h-11 w-full sm:w-auto"
                  />
                }
              >
                Keep it
              </AlertDialog.Close>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
