"use server";

import type { ProvisioningOutcome } from "@bookkeeping/application/categories";
import { initializeDefaultCategories } from "@bookkeeping/application/categories";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";

export interface RetryProvisioningActionError {
  code: "unauthenticated";
}

/**
 * The explicit provisioning retry: sign-up normally provisions the default
 * set in a post-commit hook, and this completes it when that hook failed.
 * It is lifecycle recovery, not a backfill — it runs only after sign-up or
 * sign-in, never as a side effect of a read. Ownership comes from the
 * session alone.
 */
export async function retryProvisioningAction(): Promise<
  Result<ProvisioningOutcome, RetryProvisioningActionError>
> {
  const session = await getSession();
  if (!session) {
    return err({ code: "unauthenticated" });
  }
  return ok(await initializeDefaultCategories(db, session.user.id));
}
