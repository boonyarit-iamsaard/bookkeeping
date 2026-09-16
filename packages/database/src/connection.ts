import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import {
  accounts,
  accountsRelations,
  sessions,
  sessionsRelations,
  users,
  usersRelations,
  verifications,
} from "./auth/auth.schema";
import { categories, categoriesRelations } from "./categories/category.schema";
import {
  submissionReceipts,
  transactionChanges,
  transactions,
  transactionsRelations,
} from "./transactions/transaction.schema";
import {
  walletChanges,
  wallets,
  walletsRelations,
} from "./wallets/wallet.schema";

const schema = {
  accounts,
  accountsRelations,
  sessions,
  sessionsRelations,
  users,
  usersRelations,
  verifications,
  wallets,
  walletsRelations,
  walletChanges,
  categories,
  categoriesRelations,
  transactions,
  transactionsRelations,
  submissionReceipts,
  transactionChanges,
};

/**
 * The database handle feature operations accept. Both the pooled client and
 * a transaction satisfy it, so tests can run operations inside a rollback.
 */
export type Database = PgDatabase<NodePgQueryResultHKT, typeof schema>;

export interface DatabaseConnection {
  db: Database;
  close: () => Promise<void>;
}

export function createDatabase(connectionString: string): DatabaseConnection {
  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool, schema });
  return {
    db,
    close: () => pool.end(),
  };
}
