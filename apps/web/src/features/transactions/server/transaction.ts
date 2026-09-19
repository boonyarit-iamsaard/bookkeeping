import type {
  CreateTransactionError as ApplicationCreateTransactionError,
  CreateTransactionInput as ApplicationCreateTransactionInput,
  CreateTransactionOutcome as ApplicationCreateTransactionOutcome,
} from "@bookkeeping/application/transactions";
import { createTransaction as createApplicationTransaction } from "@bookkeeping/application/transactions";
import type { Database } from "@bookkeeping/database/connection";
import type { Result } from "@bookkeeping/domain/result";
import { err } from "@bookkeeping/domain/result";

export interface CreateTransactionInput
  extends Omit<ApplicationCreateTransactionInput, "idempotencyKey"> {
  /** Legacy name retained for existing Next.js form fixtures. */
  submissionKey: string;
}

export type CreateTransactionOutcome = ApplicationCreateTransactionOutcome;

/** The old adapter name maps the application conflict for existing callers. */
export type CreateTransactionError =
  | Exclude<ApplicationCreateTransactionError, { code: "idempotency-conflict" }>
  | { code: "submission-conflict" };

/**
 * Temporary Next.js compatibility adapter. The creation operation and all
 * financial validation live in `@bookkeeping/application`; this wrapper only
 * translates the legacy form key name and conflict code.
 */
export async function createTransaction(
  db: Database,
  input: Readonly<CreateTransactionInput>,
): Promise<Result<CreateTransactionOutcome, CreateTransactionError>> {
  const { submissionKey, ...command } = input;
  const outcome = await createApplicationTransaction(db, {
    ...command,
    idempotencyKey: submissionKey,
  });
  if (!outcome.ok) {
    if (outcome.error.code === "idempotency-conflict") {
      return err({ code: "submission-conflict" });
    }
    return err(outcome.error);
  }
  return outcome;
}
