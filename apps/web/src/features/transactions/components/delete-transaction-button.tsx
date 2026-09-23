import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { formatMoney, parseMoneyInput } from "@bookkeeping/domain/money";
import type { TransactionType } from "@bookkeeping/domain/transactions";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import * as z from "zod";
import { apiClient } from "@/core/api/client";
import { parseApiMoney } from "@/core/api/money";
import { transactionQueries } from "@/core/api/queries";
import { useApiMutation } from "@/core/api/use-api-mutation";
import type { ApiRejection } from "@/core/api/write-submission";
import {
  forgetReads,
  refreshAfterWrite,
} from "@/core/query/refresh-after-write";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_SIGNS,
} from "@/features/transactions/transaction-labels";
import { Button } from "@/shared/components/ui/button";

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

const BLOCKED_STATUS = 409;
const NOT_FOUND_STATUS = 404;

/** The refunds a `refunds-exist` problem lists, as its extension carries them. */
const refundsExistProblemSchema = z.object({
  refunds: z.array(
    z.object({
      amount: z.object({ value: z.string(), currency: z.literal("THB") }),
      transactionDate: z.string(),
    }),
  ),
});

function deletionEffect(type: TransactionType) {
  if (type === "transfer") {
    return "will leave the list and both wallet balances.";
  }

  if (type === "refund") {
    return "will leave the list and the wallet balance, and the expense can be refunded again up to that amount.";
  }

  return "will leave the list and the wallet balance.";
}

/** The record stays: linked refunds still count against it. */
function describeBlocked(rejection: Readonly<ApiRejection>): string {
  const parsed = refundsExistProblemSchema.safeParse(rejection.problem);
  if (!parsed.success) {
    return (
      rejection.message ??
      "This expense has linked refunds. Delete each refund first, then delete the expense."
    );
  }
  const refunds = parsed.data.refunds
    .map(
      (refund) =>
        `${formatMoney({ amountInMinorUnits: parseApiMoney(refund.amount), currency: "THB" })} on ${formatCalendarDate(refund.transactionDate)}`,
    )
    .join(", ");
  return `This expense has linked refunds: ${refunds}. Delete each refund first, then delete the expense.`;
}

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ name: "idle" });
  const deleteTransaction = useApiMutation<undefined, unknown>({
    send: () =>
      apiClient.DELETE("/v1/transactions/{transactionId}", {
        params: { path: { transactionId: transaction.id } },
      }),
  });
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
    let result: Awaited<ReturnType<typeof deleteTransaction.submit>>;
    try {
      result = await deleteTransaction.submit(undefined);
    } catch {
      setState({ name: "failed", message: LOST_RESPONSE });
      return;
    }
    // Not found is already gone: the goal state holds, so report it as done.
    if (!result.ok && result.error.status !== NOT_FOUND_STATUS) {
      setState({
        name: "failed",
        message:
          result.error.status === BLOCKED_STATUS
            ? describeBlocked(result.error)
            : (result.error.message ?? LOST_RESPONSE),
      });
      return;
    }
    const retired = [
      transactionQueries.detail(transaction.id).queryKey,
      transactionQueries.refunds(transaction.id).queryKey,
    ];
    await refreshAfterWrite(queryClient, { retired });
    await navigate({ to: "/transactions", search: { deleted: 1 } });
    forgetReads(queryClient, retired);
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
                {deletionEffect(transaction.type)} This can't be undone.
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
