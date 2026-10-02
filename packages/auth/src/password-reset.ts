import { accounts, sessions, users } from "@bookkeeping/database/auth";
import type { Database } from "@bookkeeping/database/connection";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import { and, eq } from "drizzle-orm";
import type { Auth } from "./config";

/** Better Auth's provider id for the email/password credential. */
const CREDENTIAL_PROVIDER_ID = "credential";

export interface ResetPasswordInput {
  auth: Auth;
  db: Database;
  email: string;
  password: string;
}

export type ResetPasswordError =
  | { code: "account-not-found" }
  | { code: "password-too-short" }
  | { code: "password-too-long" };

/**
 * Sets a new password for the Account an email identifies and ends every
 * session it held. The owner runs it to recover from a lockout; the app has
 * no emailed reset flow. The length limits and the hash are Better Auth's
 * own, so the result is a password sign-in accepts. The writes go through
 * Drizzle rather than Better Auth's adapter so both commit together.
 */
export async function resetPassword({
  auth,
  db,
  email,
  password,
}: Readonly<ResetPasswordInput>): Promise<Result<void, ResetPasswordError>> {
  const [credential] = await db
    .select({ userId: users.id })
    .from(users)
    .innerJoin(accounts, eq(accounts.userId, users.id))
    .where(
      and(
        // Better Auth lowercases emails when it stores and looks them up.
        eq(users.email, email.toLowerCase()),
        eq(accounts.providerId, CREDENTIAL_PROVIDER_ID),
      ),
    );
  if (!credential) {
    return err({ code: "account-not-found" });
  }
  const { userId } = credential;
  const context = await auth.$context;
  if (password.length < context.password.config.minPasswordLength) {
    return err({ code: "password-too-short" });
  }
  if (password.length > context.password.config.maxPasswordLength) {
    return err({ code: "password-too-long" });
  }
  const hash = await context.password.hash(password);
  await db.transaction(async (tx) => {
    await tx
      .update(accounts)
      .set({ password: hash })
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.providerId, CREDENTIAL_PROVIDER_ID),
        ),
      );
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  });
  return ok(undefined);
}
