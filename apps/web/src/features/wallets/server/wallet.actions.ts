"use server";

import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import { createWallet } from "@/features/wallets/server/wallet";
import type { WalletLifecycleError } from "@/features/wallets/server/wallet-lifecycle";
import {
  correctWalletOpening,
  deleteWallet,
  setWalletArchived,
} from "@/features/wallets/server/wallet-lifecycle";
import { walletFormSchema } from "@/features/wallets/wallet-form-schema";

const manageWalletSchema = z.discriminatedUnion("operation", [
  z.object({
    id: z.uuid(),
    operation: z.literal("opening"),
    opening: walletFormSchema.pick({ openingAmount: true, openingDate: true }),
  }),
  z.object({
    id: z.uuid(),
    operation: z.enum(["archive", "unarchive", "delete"]),
  }),
]);

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

export async function manageWalletAction(
  input: unknown,
): Promise<
  Result<{ id: string }, WalletLifecycleError | "unauthenticated" | "invalid">
> {
  const session = await getSession();
  if (!session) {
    return err("unauthenticated");
  }
  const parsed = manageWalletSchema.safeParse(input);
  if (!parsed.success) {
    return err("invalid");
  }
  const data = parsed.data;
  const owned = { id: data.id, ownerId: session.user.id };
  let result: Result<{ id: string }, WalletLifecycleError>;
  if (data.operation === "opening") {
    result = await correctWalletOpening(db, { ...owned, ...data.opening });
  } else if (data.operation === "delete") {
    result = await deleteWallet(db, owned);
  } else {
    result = await setWalletArchived(db, {
      ...owned,
      archived: data.operation === "archive",
    });
  }
  if (result.ok) {
    revalidatePath("/wallets");
    revalidatePath(`/wallets/${data.id}`);
    revalidatePath("/transactions", "layout");
    revalidatePath("/dashboard");
  }
  return result;
}
