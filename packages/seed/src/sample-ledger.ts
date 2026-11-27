import { randomUUID } from "node:crypto";
import { createCategory } from "@bookkeeping/application/categories";
import { listCategories } from "@bookkeeping/application/categories/reads";
import { createTag } from "@bookkeeping/application/tags";
import { createTransaction } from "@bookkeeping/application/transactions";
import { createWallet } from "@bookkeeping/application/wallets";
import { changeWalletState } from "@bookkeeping/application/wallets/state";
import { createAuth } from "@bookkeeping/auth/config";
import { users } from "@bookkeeping/database/auth";
import type { Database } from "@bookkeeping/database/connection";
import { createDatabase } from "@bookkeeping/database/connection";
import {
  assertNoOtherAccounts,
  demoAccountEmail,
} from "@bookkeeping/database/demo-account";
import { assertLocalDatabaseUrl } from "@bookkeeping/database/local-database-url";
import { APP_TIME_ZONE, addDays, todayIn } from "@bookkeeping/domain/dates";
import type { Result } from "@bookkeeping/domain/result";
import { eq } from "drizzle-orm";
import type { WalletKey } from "./sample-ledger-cases";
import {
  categoryCases,
  openedDaysAgo,
  tagNames,
  transactionCases,
  walletCases,
} from "./sample-ledger-cases";

export interface DemoCredentials {
  email: string;
  password: string;
}

export interface SeedSampleLedgerOptions {
  /** Seeds even when the database holds Accounts other than the demo one. */
  allowOtherAccounts?: boolean;
}

// A fixed fake password: the local-only guard keeps it off any real database.
const demoPassword = "demo-password-for-local-use";

// Better Auth needs a 32-character secret to build; sign-up here issues a
// session nobody uses, so the value protects nothing.
const seedAuthSecret = "sample-ledger-seed-secret-not-for-real-use";

/** Every use case returns a Result; a refusal here means the cases are wrong. */
function expectOk<Value>(result: Result<Value, unknown>, doing: string) {
  if (!result.ok) {
    throw new Error(
      `Sample ledger: ${doing} was refused: ${JSON.stringify(result.error)}`,
    );
  }
  return result.value;
}

async function createWallets(db: Database, ownerId: string) {
  const ids = new Map<WalletKey, string>();
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  for (const wallet of walletCases) {
    const created = await createWallet(db, {
      ownerId,
      idempotencyKey: randomUUID(),
      name: wallet.name,
      type: wallet.type,
      savings: wallet.savings,
      openingAmount: wallet.opening,
      openingDate: addDays(today, -openedDaysAgo),
    });
    ids.set(wallet.key, expectOk(created, `Wallet ${wallet.name}`).id);
  }
  return ids;
}

type CategoryKey = `${string}:${string}`;

/** The key a Category is found by: its kind and the label a person reads. */
function categoryKey(kind: string, label: string): CategoryKey {
  return `${kind}:${label}`;
}

async function createCategories(db: Database, ownerId: string) {
  for (const { kind, parent, child, iconId } of categoryCases) {
    const created = await createCategory(db, {
      ownerId,
      idempotencyKey: randomUUID(),
      kind,
      name: child,
      iconId,
      parent: { create: { name: parent, iconId } },
    });
    expectOk(created, `Category ${parent} › ${child}`);
  }
  // Sign-up provisioned the default categories; look every one up by the label
  // a person reads: "Parent" or "Parent › Child", per kind.
  const listed = await listCategories(db, ownerId);
  const ids = new Map<CategoryKey, string>();
  for (const category of listed) {
    const parent = listed.find(({ id }) => id === category.parentId);
    const label = parent ? `${parent.name} › ${category.name}` : category.name;
    ids.set(categoryKey(category.kind, label), category.id);
  }
  return ids;
}

async function createTags(db: Database, ownerId: string) {
  const ids = new Map<string, string>();
  for (const name of tagNames) {
    const created = await createTag(db, {
      ownerId,
      idempotencyKey: randomUUID(),
      name,
    });
    ids.set(name, expectOk(created, `Tag ${name}`).id);
  }
  return ids;
}

function requireId<Key extends string>(
  ids: ReadonlyMap<Key, string>,
  key: Key,
) {
  const id = ids.get(key);
  if (id === undefined) {
    throw new Error(`Sample ledger names ${key}, which does not exist`);
  }
  return id;
}

interface LedgerIds {
  wallets: ReadonlyMap<WalletKey, string>;
  categories: ReadonlyMap<CategoryKey, string>;
  tags: ReadonlyMap<string, string>;
}

interface CreateTransactionsOptions {
  ownerId: string;
  ids: LedgerIds;
}

async function createTransactions(
  db: Database,
  { ownerId, ids }: Readonly<CreateTransactionsOptions>,
) {
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  const refundableIds = new Map<string, string>();
  // Oldest first, so recorded order follows the dates and a Refund follows its expense.
  const chronological = transactionCases.toSorted(
    (a, b) => b.daysAgo - a.daysAgo,
  );
  for (const sample of chronological) {
    const created = await createTransaction(db, {
      ownerId,
      idempotencyKey: randomUUID(),
      type: sample.type,
      walletId: requireId(ids.wallets, sample.wallet),
      destinationWalletId: sample.to ? requireId(ids.wallets, sample.to) : null,
      categoryId: sample.category
        ? requireId(ids.categories, categoryKey(sample.type, sample.category))
        : null,
      refundOfTransactionId: sample.refundOf
        ? requireId(refundableIds, sample.refundOf)
        : null,
      amount: sample.amount,
      transactionDate: addDays(today, -sample.daysAgo),
      note: sample.note ?? "",
      tagIds: (sample.tags ?? []).map((name) => requireId(ids.tags, name)),
    });
    const transaction = expectOk(
      created,
      `${sample.type} ${sample.note ?? ""}`,
    );
    if (sample.expenseKey) {
      refundableIds.set(sample.expenseKey, transaction.id);
    }
  }
}

interface ArchiveWalletsOptions {
  ownerId: string;
  walletIds: ReadonlyMap<WalletKey, string>;
}

async function archiveWallets(
  db: Database,
  { ownerId, walletIds }: Readonly<ArchiveWalletsOptions>,
) {
  for (const wallet of walletCases) {
    if ("archived" in wallet) {
      const archived = await changeWalletState(db, {
        ownerId,
        id: requireId(walletIds, wallet.key),
        archived: true,
      });
      expectOk(archived, `archiving ${wallet.name}`);
    }
  }
}

async function writeSampleLedger(db: Database, ownerId: string) {
  const wallets = await createWallets(db, ownerId);
  const categories = await createCategories(db, ownerId);
  const tags = await createTags(db, ownerId);
  await createTransactions(db, {
    ownerId,
    ids: { wallets, categories, tags },
  });
  await archiveWallets(db, { ownerId, walletIds: wallets });
}

/**
 * Fills a local, migrated database with one sample ledger owned by the demo
 * Account and returns the credentials that sign in to it. A re-run replaces
 * the demo Account; any other Account is never written or deleted.
 */
export async function seedSampleLedger(
  url: string,
  options: Readonly<SeedSampleLedgerOptions> = {},
): Promise<DemoCredentials> {
  assertLocalDatabaseUrl(url);
  const connection = createDatabase(url);
  try {
    if (!options.allowOtherAccounts) {
      await assertNoOtherAccounts(connection.pool, "seed");
    }
    // Every table the demo Account owns cascades from its user row.
    await connection.db.delete(users).where(eq(users.email, demoAccountEmail));
    const auth = createAuth({
      db: connection.db,
      secret: seedAuthSecret,
      baseURL: "http://localhost:4000",
      signUpEnabled: true,
      rateLimitEnabled: false,
    });
    const { user } = await auth.api.signUpEmail({
      body: { name: "Demo", email: demoAccountEmail, password: demoPassword },
    });
    await writeSampleLedger(connection.db, user.id);
    return { email: demoAccountEmail, password: demoPassword };
  } finally {
    await connection.close();
  }
}
