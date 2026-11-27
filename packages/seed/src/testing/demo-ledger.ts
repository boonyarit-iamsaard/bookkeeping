import { createTagForTest } from "@bookkeeping/application/testing/tag-fixture";
import { createWalletForTest } from "@bookkeeping/application/testing/wallet-fixture";
import { listWalletsWithBalance } from "@bookkeeping/application/wallets";
import { createAuth } from "@bookkeeping/auth/config";
import { users } from "@bookkeeping/database/auth";
import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { migrateDatabase } from "@bookkeeping/database/migrate";
import { tags, transactionTags } from "@bookkeeping/database/tags";
import { withEmptyDatabase } from "@bookkeeping/database/testing/empty-database";
import { withConnection } from "@bookkeeping/database/testing/with-connection";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import { eq } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { DemoCredentials } from "../sample-ledger";

/** Runs `use` against a migrated database of its own, as `db:fresh` leaves one. */
export function withMigratedDatabase(use: (url: string) => Promise<void>) {
  return withEmptyDatabase(async (url) => {
    await migrateDatabase(url);
    await use(url);
  });
}

function createTestAuth(db: Database) {
  return createAuth({
    db,
    secret: "demo-ledger-test-secret-with-at-least-32-chars",
    baseURL: "http://localhost:4000",
  });
}

export function signIn(url: string, credentials: DemoCredentials) {
  return withConnection(url, ({ db }) =>
    createTestAuth(db).api.signInEmail({ body: credentials }),
  );
}

export const otherAccountEmail = "other@bookkeeping.test";

/** Signs up an Account that is not the demo one and gives it a wallet and a tag. */
export function addOtherAccount(url: string) {
  return withConnection(url, async ({ db }) => {
    const { user } = await createTestAuth(db).api.signUpEmail({
      body: {
        name: "Other",
        email: otherAccountEmail,
        password: "other-account-password",
      },
    });
    await createWalletForTest(db, { ownerId: user.id });
    await createTagForTest(db, { ownerId: user.id, name: "Kept" });
  });
}

/** The Wallets and balances an Account's Home screen shows, through the application read. */
export function readWalletBalances(url: string, email: string) {
  return withConnection(url, async ({ db }) => {
    const [owner] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    if (!owner) {
      throw new Error(`No Account ${email}`);
    }
    return await listWalletsWithBalance(db, { ownerId: owner.id });
  });
}

/** Everything the Account with this email owns, read the way a caller sees it. */
export function readOwnedRecords(url: string, email: string) {
  return withConnection(url, async ({ db }) => {
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
  });
}
