"use server";

import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { formatMoney } from "@bookkeeping/domain/money";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import type { RefundSummary } from "@bookkeeping/domain/transactions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import type {
  CreateTransactionError,
  DeleteTransactionError,
  UpdateTransactionError,
} from "@/features/transactions/server/transaction";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/features/transactions/server/transaction";
import {
  createTransactionSubmissionSchema,
  updateTransactionSubmissionSchema,
} from "@/features/transactions/transaction-form-schema";

const TRANSACTION_FORM_FIELDS = [
  "amount",
  "walletId",
  "destinationWalletId",
  "categoryId",
  "transactionDate",
  "note",
] as const;
export type TransactionFormField = (typeof TRANSACTION_FORM_FIELDS)[number];

/**
 * Every error here is definitive: the server answered and nothing was
 * committed (or, for `conflict`, the key already belongs to another payload).
 * Only a thrown/network failure is an uncertain outcome.
 */
export type TransactionActionError =
  | { code: "unauthenticated" }
  | { code: "invalid"; field?: TransactionFormField; message: string }
  | { code: "conflict"; message: string }
  /** The record is gone (deleted, or never this user's). */
  | { code: "not-found"; message: string };

export interface TransactionActionSuccess {
  id: string;
  /** True when the receipt already existed; the original record is returned. */
  replayed: boolean;
}

/**
 * Server Functions are reachable by direct POST, so the session is checked
 * here, not only in the layout. Ownership comes from the session alone; the
 * input carries no user identifier. Financial validation happens here and
 * again inside the committing operation, never only in the form.
 */
export async function createTransactionAction(
  input: unknown,
): Promise<Result<TransactionActionSuccess, TransactionActionError>> {
  const session = await getSession();
  if (!session) {
    return err({ code: "unauthenticated" });
  }

  const parsed = createTransactionSubmissionSchema().safeParse(input);
  if (!parsed.success) {
    return err(describeInvalidInput(parsed.error));
  }

  // Ownership comes last so nothing in the parsed input can override it.
  const outcome = await createTransaction(db, {
    ...parsed.data,
    categoryId: parsed.data.categoryId || null,
    destinationWalletId: parsed.data.destinationWalletId || null,
    refundOfTransactionId: parsed.data.refundOfTransactionId || null,
    ownerId: session.user.id,
  });
  if (!outcome.ok) {
    return err(describeRejection(outcome.error));
  }

  revalidateTransactionPages();
  return ok({
    id: outcome.value.transaction.id,
    replayed: outcome.value.replayed,
  });
}

/**
 * Corrects one of the session user's own transactions. The type is fixed;
 * every other field is re-validated here and inside the committing
 * operation. Success returns to the list like a create.
 */
export async function updateTransactionAction(
  input: unknown,
): Promise<Result<TransactionActionSuccess, TransactionActionError>> {
  const session = await getSession();
  if (!session) {
    return err({ code: "unauthenticated" });
  }

  const parsed = updateTransactionSubmissionSchema().safeParse(input);
  if (!parsed.success) {
    return err(describeInvalidInput(parsed.error));
  }

  const outcome = await updateTransaction(db, {
    ...parsed.data,
    categoryId: parsed.data.categoryId || null,
    destinationWalletId: parsed.data.destinationWalletId || null,
    ownerId: session.user.id,
  });
  if (!outcome.ok) {
    return err(describeRejection(outcome.error));
  }

  revalidateTransactionPages(outcome.value.id);
  return ok({ id: outcome.value.id, replayed: false });
}

export type DeleteTransactionActionError =
  | { code: "unauthenticated" }
  | { code: "not-found"; message: string }
  /** The record stays: linked refunds still count against it. */
  | { code: "blocked"; message: string };

/** Deletes an owned transaction and leaves its now-missing edit page. */
export async function deleteTransactionAction(
  input: unknown,
): Promise<Result<never, DeleteTransactionActionError>> {
  const session = await getSession();
  if (!session) {
    return err({ code: "unauthenticated" });
  }
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) {
    return err(NOT_FOUND);
  }

  const outcome = await deleteTransaction(db, {
    ownerId: session.user.id,
    id: parsed.data.id,
  });
  if (!outcome.ok) {
    return err(describeDeleteRejection(outcome.error));
  }

  revalidateTransactionPages(outcome.value.id);
  // Redirect in this response so revalidation renders the list, not a 404
  // for the deleted transaction before client-side navigation can run.
  redirect("/transactions?deleted=1");
}

const NOT_FOUND = {
  code: "not-found",
  message: "This transaction is no longer available. It may have been deleted.",
} as const;

function describeDeleteRejection(
  error: DeleteTransactionError,
): DeleteTransactionActionError {
  switch (error.code) {
    case "transaction-not-found":
      return NOT_FOUND;
    case "refunds-exist":
      return {
        code: "blocked",
        message: `This expense has linked refunds: ${describeRefunds(error.refunds)}. Delete each refund first, then delete the expense.`,
      };
  }
}

function describeRefunds(refunds: readonly RefundSummary[]): string {
  return refunds
    .map(
      (refund) =>
        `${formatMoney({ amountInMinorUnits: refund.amount, currency: "THB" })} on ${formatCalendarDate(refund.transactionDate)}`,
    )
    .join(", ");
}

/**
 * A refund changes its expense's detail too, and a deleted refund's own
 * pages are gone; the dynamic patterns cover every linked page at once.
 */
function revalidateTransactionPages(id?: string) {
  revalidatePath("/transactions");
  revalidatePath("/wallets");
  revalidatePath("/dashboard");
  revalidatePath("/transactions/[id]", "page");
  revalidatePath("/transactions/[id]/edit", "page");
  revalidatePath("/transactions/[id]/refund", "page");
  if (id) {
    revalidatePath(`/transactions/${id}`);
    revalidatePath(`/transactions/${id}/edit`);
  }
}

const FORM_FIELD_NAMES: ReadonlySet<string> = new Set(TRANSACTION_FORM_FIELDS);

function isFormField(value: unknown): value is TransactionFormField {
  return typeof value === "string" && FORM_FIELD_NAMES.has(value);
}

function describeInvalidInput(error: z.ZodError): TransactionActionError {
  const [issue] = error.issues;
  const field = issue?.path[0];
  return {
    code: "invalid",
    field: isFormField(field) ? field : undefined,
    message: issue?.message ?? "Some details were not accepted",
  };
}

function describeRejection(
  error: CreateTransactionError | UpdateTransactionError,
): TransactionActionError {
  switch (error.code) {
    case "transaction-not-found":
      return NOT_FOUND;
    case "wallet-not-found":
      return {
        code: "invalid",
        field: "walletId",
        message: "That wallet is not available. Choose another wallet.",
      };
    case "destination-wallet-not-found":
    case "same-wallet":
    case "invalid-transfer":
      return {
        code: "invalid",
        field: "destinationWalletId",
        message:
          "Choose two different available wallets. Transfers have no category.",
      };
    case "wallet-archived":
      return {
        code: "invalid",
        message:
          "That wallet is archived. Choose an active wallet or retain this transaction’s existing wallets.",
      };
    case "invalid-currency":
      return { code: "invalid", message: "Currency must be THB." };
    case "category-not-found":
    case "category-kind-mismatch":
      return {
        code: "invalid",
        field: "categoryId",
        message:
          "That category is not available for this type. Choose another.",
      };
    case "amount-out-of-range":
      return {
        code: "invalid",
        field: "amount",
        message: "The amount must be between ฿0.01 and ฿99,999,999.99",
      };
    case "note-too-long":
      return {
        code: "invalid",
        field: "note",
        message: "Notes can be at most 200 characters",
      };
    case "future-date":
      return {
        code: "invalid",
        field: "transactionDate",
        message: `The date cannot be after today, ${formatCalendarDate(error.today)}`,
      };
    case "before-opening":
      return {
        code: "invalid",
        field: "transactionDate",
        message: `This wallet opened on ${formatCalendarDate(error.openingDate)}; earlier dates are not tracked`,
      };
    case "invalid-refund":
      return {
        code: "invalid",
        message:
          "A refund is recorded from its expense and always follows the expense’s category.",
      };
    case "expense-not-found":
      return {
        code: "invalid",
        message:
          "The refunded expense is no longer available. It may have been deleted.",
      };
    case "before-expense":
      return {
        code: "invalid",
        field: "transactionDate",
        message: `The expense is dated ${formatCalendarDate(error.expenseDate)}; a refund cannot come before it`,
      };
    case "exceeds-refundable":
      return {
        code: "invalid",
        field: "amount",
        message:
          error.remaining > 0n
            ? `Only ${formatMoney({ amountInMinorUnits: error.remaining, currency: "THB" })} of this expense is left to refund`
            : "This expense is already fully refunded",
      };
    case "below-refunded":
      return {
        code: "invalid",
        field: "amount",
        message: `${formatMoney({ amountInMinorUnits: error.refundedTotal, currency: "THB" })} of this expense has been refunded; the amount cannot go below that`,
      };
    case "after-refund":
      return {
        code: "invalid",
        field: "transactionDate",
        message: `A linked refund is dated ${formatCalendarDate(error.refundDate)}; the expense cannot come after it`,
      };
    case "submission-conflict":
      return {
        code: "conflict",
        message:
          "This submission was already saved with different details. Start a new entry to record another transaction.",
      };
  }
}
