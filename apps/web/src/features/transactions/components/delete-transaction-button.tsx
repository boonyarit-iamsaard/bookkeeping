import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { formatMoney, parseMoneyInput } from "@bookkeeping/domain/money";
import type { TransactionType } from "@bookkeeping/domain/transactions";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import * as z from "zod";
import { apiClient } from "@/core/api/client";
import { apiMoneySchema } from "@/core/api/money";
import { transactionQueries } from "@/core/api/queries";
import { describeRejection } from "@/core/api/rejection-wording";
import { useFormWrites } from "@/core/api/use-form-writes";
import type { ApiRejection } from "@/core/api/write-submission";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_SIGNS,
} from "@/features/transactions/transaction-labels";
import { ErrorNotice } from "@/shared/components/error-notice";
import { Button } from "@/shared/components/ui/button";
import { SheetPortal } from "@/shared/components/ui/sheet";

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

const BLOCKED_STATUS = 409;

/** The refunds a `refunds-exist` problem lists, as its extension carries them. */
const refundsExistProblemSchema = z.object({
  refunds: z.array(
    z.object({
      amount: apiMoneySchema,
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
        `${formatMoney({ amountInMinorUnits: refund.amount, currency: "THB" })} on ${formatCalendarDate(refund.transactionDate)}`,
    )
    .join(", ");
  return `This expense has linked refunds: ${refunds}. Delete each refund first, then delete the expense.`;
}

function describeDeleteRejection(
  rejection: Readonly<ApiRejection>,
): string | undefined {
  return rejection.status === BLOCKED_STATUS
    ? describeBlocked(rejection)
    : describeRejection(rejection);
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
  const [open, setOpen] = useState(false);
  const { submit, pending, serverError, clearErrors } = useFormWrites({
    fields: [],
    writes: {
      remove: {
        kind: "delete",
        send: () =>
          apiClient.DELETE("/v1/transactions/{transactionId}", {
            params: { path: { transactionId: transaction.id } },
          }),
        describeRejection: describeDeleteRejection,
        retired: [
          transactionQueries.detail(transaction.id).queryKey,
          transactionQueries.refunds(transaction.id).queryKey,
        ],
        onDone: () => navigate({ to: "/transactions", search: { deleted: 1 } }),
      },
    },
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

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (pending) {
          return;
        }
        setOpen(next);
        if (next) {
          clearErrors();
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

      <SheetPortal>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pt-6 pb-2 sm:px-6">
          <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-lg">
            <Trash2 aria-hidden="true" strokeWidth={2} className="size-6" />
          </span>
          <div className="flex flex-col gap-1.5">
            <AlertDialog.Title className="text-lg leading-tight font-bold tracking-tight">
              Delete this {noun}?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-muted-foreground text-sm leading-normal">
              {figure && (
                <>
                  <span className="money text-foreground font-medium">
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
          {serverError && <ErrorNotice>{serverError}</ErrorNotice>}
        </div>
        <div className="flex shrink-0 flex-col gap-3 px-5 pt-4 pb-6 sm:flex-row-reverse sm:px-6">
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={pending}
            onClick={() => submit("remove")}
            className="h-12 w-full text-base sm:h-11 sm:w-auto sm:text-sm"
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
          <AlertDialog.Close
            disabled={pending}
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
      </SheetPortal>
    </AlertDialog.Root>
  );
}
