"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import type { CreateTransactionError } from "@/features/transactions/server/operations";
import { createTransaction } from "@/features/transactions/server/operations";
import { createTransactionSubmissionSchema } from "@/features/transactions/transaction-form-schema";
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
export type CreateTransactionActionError =
  | { code: "unauthenticated" }
  | { code: "invalid"; field?: TransactionFormField; message: string }
  | { code: "conflict"; message: string };

export interface CreateTransactionActionSuccess {
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
): Promise<
  Result<CreateTransactionActionSuccess, CreateTransactionActionError>
> {
  const session = await getSession();
  if (!session) {
    return err({ code: "unauthenticated" });
  }

  const parsed = createTransactionSubmissionSchema().safeParse(input);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const field = issue?.path[0];
    return err({
      code: "invalid",
      field: isFormField(field) ? field : undefined,
      message: issue?.message ?? "Some details were not accepted",
    });
  }

  // Ownership comes last so nothing in the parsed input can override it.
  const outcome = await createTransaction(db, {
    ...parsed.data,
    ownerId: session.user.id,
  });
  if (!outcome.ok) {
    return err(describeRejection(outcome.error));
  }

  revalidatePath("/transactions");
  revalidatePath("/wallets");
  return ok({
    id: outcome.value.transaction.id,
    replayed: outcome.value.replayed,
  });
}

function isFormField(value: unknown): value is TransactionFormField {
  return TRANSACTION_FORM_FIELDS.some((field) => field === value);
}

function describeRejection(
  error: CreateTransactionError,
): CreateTransactionActionError {
  switch (error.code) {
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
