"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import { createWallet } from "@/features/wallets/server/operations";
import { walletFormSchema } from "@/features/wallets/wallet-form-schema";
import type { Result } from "@/shared/helpers/result";
import { err, ok } from "@/shared/helpers/result";

export type CreateWalletActionError = "unauthenticated" | "invalid";

/**
 * Server Functions are reachable by direct POST, so the session is checked
 * here, not only in the layout. Ownership comes from the session alone; the
 * input carries no user identifier.
 */
export async function createWalletAction(
  input: unknown,
): Promise<Result<{ id: string }, CreateWalletActionError>> {
  const session = await getSession();
  if (!session) {
    return err("unauthenticated");
  }

  const parsed = walletFormSchema.safeParse(input);
  if (!parsed.success) {
    return err("invalid");
  }

  // Ownership comes last so nothing in the parsed input can override it.
  const wallet = await createWallet(db, {
    ...parsed.data,
    ownerId: session.user.id,
  });

  revalidatePath("/wallets");
  return ok({ id: wallet.id });
}
