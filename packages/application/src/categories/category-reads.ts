import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { transactions } from "@bookkeeping/database/transactions";
import type { CategorySummary } from "@bookkeeping/domain/categories";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { isUuid } from "../shared/identifier";

/** The columns every read and write returns: a `CategorySummary` row. */
export const categorySummaryColumns = {
  id: categories.id,
  kind: categories.kind,
  parentId: categories.parentId,
  name: categories.name,
  iconId: categories.iconId,
  isProtected: categories.isProtected,
};

/** Both trees, parents before their children, in picker order. */
export async function listCategories(
  db: Database,
  ownerId: string,
): Promise<readonly CategorySummary[]> {
  const rows = await db
    .select(categorySummaryColumns)
    .from(categories)
    .where(eq(categories.userId, ownerId))
    .orderBy(
      asc(categories.kind),
      sql`${categories.parentId} is not null`,
      asc(categories.sortOrder),
      asc(categories.name),
      asc(categories.id),
    );
  return rows;
}

export interface CategoryRef {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  id: string;
}

/** One owned category, or `null` when the owner has no category with that id. */
export async function findCategory(
  db: Database,
  { ownerId, id }: Readonly<CategoryRef>,
): Promise<CategorySummary | null> {
  if (!isUuid(id)) {
    return null;
  }
  const [category] = await db
    .select(categorySummaryColumns)
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, ownerId)));
  return category ?? null;
}

export interface CategoryUsage {
  /** Current (not deleted) income and expense transactions filed here. */
  transactions: number;
  /** Direct children; a parent with any cannot itself be removed. */
  children: number;
}

/**
 * The usage of one owned category, or `null` when the owner has no category
 * with that id. Refunds carry no category, so only the transactions and
 * children the management UX counts appear here, read in one statement.
 */
export async function findCategoryUsage(
  db: Database,
  { ownerId, id }: Readonly<CategoryRef>,
): Promise<CategoryUsage | null> {
  if (!isUuid(id)) {
    return null;
  }
  const child = alias(categories, "child");
  const currentTransactions = db
    .select({ count: countRows() })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, categories.userId),
        eq(transactions.categoryId, categories.id),
        isNull(transactions.deletedAt),
      ),
    );
  const directChildren = db
    .select({ count: countRows() })
    .from(child)
    .where(
      and(
        eq(child.userId, categories.userId),
        eq(child.parentId, categories.id),
      ),
    );
  const [usage] = await db
    .select({
      transactions: sql<number>`${currentTransactions}`,
      children: sql<number>`${directChildren}`,
    })
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, ownerId)));
  return usage ?? null;
}

/**
 * How many current income and expense transactions each category holds, keyed
 * by category id; unused categories are absent. Refunds are not counted:
 * they follow their expense, which already is.
 */
export async function listCategoryUsage(
  db: Database,
  ownerId: string,
): Promise<Readonly<Record<string, number>>> {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      count: countRows(),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, ownerId),
        isNotNull(transactions.categoryId),
        isNull(transactions.deletedAt),
      ),
    )
    .groupBy(transactions.categoryId);
  const usage: Record<string, number> = {};
  for (const row of rows) {
    if (row.categoryId) {
      usage[row.categoryId] = row.count;
    }
  }
  return usage;
}

function countRows() {
  return sql<number>`count(*)::int`;
}
