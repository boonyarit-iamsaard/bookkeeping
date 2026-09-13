"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import type {
  CreateTransactionError,
  UpdateTransactionError,
} from "@/features/transactions/server/operations";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/features/transactions/server/operations";
import {
  createTransactionSubmissionSchema,
  updateTransactionSubmissionSchema,
} from "@/features/transactions/transaction-form-schema";
import { formatCalendarDate } from "@/shared/helpers/dates";
import type { Result } from "@/shared/helpers/result";
import { err, ok } from "@/shared/helpers/result";

const TRANSACTION_FORM_FIELDS = [
  "amount",
  "walletId",
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
  | { code: "not-found"; message: string };

/** Deletes one of the session user's own transactions; repeating it is harmless. */
export async function deleteTransactionAction(
  input: unknown,
): Promise<Result<{ id: string }, DeleteTransactionActionError>> {
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
    return err(NOT_FOUND);
  }

  revalidateTransactionPages(outcome.value.id);
  return ok({ id: outcome.value.id });
}

const NOT_FOUND = {
  code: "not-found",
  message: "This transaction is no longer available. It may have been deleted.",
} as const;

function revalidateTransactionPages(id?: string) {
  revalidatePath("/transactions");
  revalidatePath("/wallets");
  if (id) {
    revalidatePath(`/transactions/${id}`);
    revalidatePath(`/transactions/${id}/edit`);
  }
}

function isFormField(value: unknown): value is TransactionFormField {
  return TRANSACTION_FORM_FIELDS.some((field) => field === value);
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
    case "submission-conflict":
      return {
        code: "conflict",
        message:
          "This submission was already saved with different details. Start a new entry to record another transaction.",
      };
  }
}
