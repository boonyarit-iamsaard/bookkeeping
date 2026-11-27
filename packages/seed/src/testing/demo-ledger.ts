import { createTagForTest } from "@bookkeeping/application/testing/tag-fixture";
import { createWalletForTest } from "@bookkeeping/application/testing/wallet-fixture";
import { listWalletsWithBalance } from "@bookkeeping/application/wallets";
import { createAuth } from "@bookkeeping/auth/config";
import { users } from "@bookkeeping/database/auth";
import { categories } from "@bookkeeping/database/categories";
import { createDatabase } from "@bookkeeping/database/connection";
import { migrateDatabase } from "@bookkeeping/database/migrate";
import { tags, transactionTags } from "@bookkeeping/database/tags";
import { withEmptyDatabase } from "@bookkeeping/database/testing/empty-database";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import { eq } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/** Runs `use` against a migrated database of its own, as `db:fresh` leaves one. */
export function withMigratedDatabase(use: (url: string) => Promise<void>) {
  return withEmptyDatabase(async (url) => {
    await migrateDatabase(url);
    await use(url);
  });
}

export async function signIn(
  url: string,
  credentials: Readonly<{ email: string; password: string }>,
) {
  const connection = createDatabase(url);
  try {
    const auth = createAuth({
      db: connection.db,
      secret: "sign-in-check-secret-with-at-least-32-chars",
      baseURL: "http://localhost:4000",
    });
    return await auth.api.signInEmail({ body: credentials });
  } finally {
    await connection.close();
  }
}

export const otherAccountEmail = "other@bookkeeping.test";

/** Signs up an Account that is not the demo one and gives it a wallet and a tag. */
export async function addOtherAccount(url: string): Promise<void> {
  const connection = createDatabase(url);
  try {
    const auth = createAuth({
      db: connection.db,
      secret: "other-account-secret-with-at-least-32-chars",
      baseURL: "http://localhost:4000",
    });
    const { user } = await auth.api.signUpEmail({
      body: {
        name: "Other",
        email: otherAccountEmail,
        password: "other-account-password",
      },
    });
    await createWalletForTest(connection.db, { ownerId: user.id });
    await createTagForTest(connection.db, { ownerId: user.id, name: "Kept" });
  } finally {
    await connection.close();
  }
}

/** The Wallets and balances an Account's Home screen shows, through the application read. */
export async function readWalletBalances(url: string, email: string) {
  const connection = createDatabase(url);
  try {
    const [owner] = await connection.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    if (!owner) {
      throw new Error(`No Account ${email}`);
    }
    return await listWalletsWithBalance(connection.db, { ownerId: owner.id });
  } finally {
    await connection.close();
  }
}

/** Everything the Account with this email owns, read the way a caller sees it. */
export async function readOwnedRecords(url: string, email: string) {
  const connection = createDatabase(url);
  try {
    const { db } = connection;
    const owners = await db.select().from(users).where(eq(users.email, email));
    const [owner] = owners;
    if (!owner) {
      return {
        accounts: 0,
        wallets: [],
        categories: [],
        tags: [],
        transactions: [],
        tagLinks: [],
      };
    }
    const ownedBy = (table: { userId: AnyPgColumn }) =>
      eq(table.userId, owner.id);
    return {
      accounts: owners.length,
      wallets: await db.select().from(wallets).where(ownedBy(wallets)),
      categories: await db.select().from(categories).where(ownedBy(categories)),
      tags: await db.select().from(tags).where(ownedBy(tags)),
      transactions: await db
        .select()
        .from(transactions)
        .where(ownedBy(transactions)),
      tagLinks: await db
        .select({ transactionId: transactionTags.transactionId })
        .from(transactionTags)
        .innerJoin(tags, eq(tags.id, transactionTags.tagId))
        .where(ownedBy(tags)),
    };
  } finally {
    await connection.close();
  }
}
