import {
  categorySummaryColumns,
  isScopedNameViolation,
  validateName,
} from "@bookkeeping/application/categories";
import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { databaseError } from "@bookkeeping/database/errors";
import { transactions } from "@bookkeeping/database/transactions";
import type { CategorySummary } from "@bookkeeping/domain/categories";
import { normalizeCategoryName } from "@bookkeeping/domain/categories";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { isIconId } from "@/features/categories/icons";

export interface ManageCategoryInput {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  id: string;
}

export interface UpdateCategoryInput extends ManageCategoryInput {
  name: string;
  iconId: string;
}

export type UpdateCategoryError =
  | { code: "category-not-found" }
  | { code: "blank-name" }
  | { code: "name-too-long" }
  | { code: "unknown-icon" }
  /** Same name, case-insensitively, already in scope (tree or parent). */
  | { code: "duplicate-name" }
  /** Uncategorized keeps its name; only its icon may change. */
  | { code: "protected" };

/**
 * Renames a category and/or changes its icon. The level and parent never
 * change here; scoped uniqueness is enforced by the same partial indexes
 * that guard creation. Uncategorized's name is fixed by a guard on the
 * update itself, so no read-then-write window exists.
 */
export async function updateCategory(
  db: Database,
  input: Readonly<UpdateCategoryInput>,
): Promise<Result<CategorySummary, UpdateCategoryError>> {
  const name = normalizeCategoryName(input.name);
  const invalidName = validateName(name, "name");
  if (invalidName) {
    return err({ code: invalidName.code });
  }
  if (!isIconId(input.iconId)) {
    return err({ code: "unknown-icon" });
  }
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .update(categories)
        .set({ name, iconId: input.iconId })
        .where(
          and(
            eq(categories.id, input.id),
            eq(categories.userId, input.ownerId),
            or(eq(categories.isProtected, false), eq(categories.name, name)),
          ),
        )
        .returning(categorySummaryColumns);
      if (row) {
        return ok(row);
      }
      const [current] = await tx
        .select({ isProtected: categories.isProtected })
        .from(categories)
        .where(
          and(
            eq(categories.id, input.id),
            eq(categories.userId, input.ownerId),
          ),
        );
      return err({
        code: current?.isProtected ? "protected" : "category-not-found",
      });
    });
  } catch (error) {
    if (isScopedNameViolation(error)) {
      return err({ code: "duplicate-name" });
    }
    throw error;
  }
}

export type RemoveCategoryError =
  | { code: "category-not-found" }
  /** Uncategorized is the fallback; it cannot itself be removed. */
  | { code: "protected" }
  /** Every child, used or not, must go before its parent. */
  | { code: "has-children" }
  /** A concurrent write claimed the category as it was being removed. */
  | { code: "in-use" };

export interface RemoveCategoryOutcome {
  /** The parent for a child, the tree's Uncategorized for a parent. */
  fallbackId: string;
  /** Transactions moved to the fallback, retained deleted ones included. */
  reassigned: number;
}

/** A restrict foreign key refusing the delete; 23503 for a deferred one. */
const RESTRICT_VIOLATIONS = new Set(["23001", "23503"]);
const TRANSACTION_CATEGORY_FK = "transactions_category_id_categories_id_fk";
const CHILD_PARENT_FK = "categories_parent_id_categories_id_fk";

/**
 * Removes a category and moves its transactions to the fallback in one
 * transaction; refunds read their expense's category, so they follow by
 * themselves. Transaction rows are locked before the category row, the
 * same order edits take, so the two never deadlock. The restrict foreign
 * keys are the final word: a transaction or child committed meanwhile
 * fails the delete, and nothing is changed.
 */
export async function removeCategory(
  db: Database,
  input: Readonly<ManageCategoryInput>,
): Promise<Result<RemoveCategoryOutcome, RemoveCategoryError>> {
  try {
    return await db.transaction(async (tx) => {
      const [category] = await tx
        .select(categorySummaryColumns)
        .from(categories)
        .where(
          and(
            eq(categories.id, input.id),
            eq(categories.userId, input.ownerId),
          ),
        );
      if (!category) {
        return err({ code: "category-not-found" });
      }
      if (category.isProtected) {
        return err({ code: "protected" });
      }
      const fallback = await fallbackFor(tx, {
        ownerId: input.ownerId,
        category,
      });
      if (fallback.kind === "has-children") {
        return err({ code: "has-children" });
      }
      const fallbackId = fallback.id;
      const moved = await tx
        .update(transactions)
        .set({ categoryId: fallbackId })
        .where(eq(transactions.categoryId, category.id))
        .returning({ id: transactions.id });
      const deleted = await tx
        .delete(categories)
        .where(eq(categories.id, category.id))
        .returning({ id: categories.id });
      if (deleted.length === 0) {
        // A concurrent removal won; roll back so its outcome stands alone.
        throw new AlreadyRemoved();
      }
      return ok({ fallbackId, reassigned: moved.length });
    });
  } catch (error) {
    if (error instanceof AlreadyRemoved) {
      return err({ code: "category-not-found" });
    }
    const cause = databaseError(error);
    if (cause && RESTRICT_VIOLATIONS.has(cause.code)) {
      if (cause.constraint === CHILD_PARENT_FK) {
        return err({ code: "has-children" });
      }
      if (cause.constraint === TRANSACTION_CATEGORY_FK) {
        return err({ code: "in-use" });
      }
    }
    throw error;
  }
}

/** Unwinds the removal transaction once the category is found already gone. */
class AlreadyRemoved extends Error {}

type Fallback = { kind: "fallback"; id: string } | { kind: "has-children" };

/** The parent of a child; for a childless parent, its tree's Uncategorized. */
async function fallbackFor(
  tx: Database,
  { ownerId, category }: Readonly<FallbackOptions>,
): Promise<Fallback> {
  if (category.parentId) {
    return { kind: "fallback", id: category.parentId };
  }
  const [child] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.parentId, category.id))
    .limit(1);
  if (child) {
    return { kind: "has-children" };
  }
  const [uncategorized] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, ownerId),
        eq(categories.kind, category.kind),
        eq(categories.isProtected, true),
      ),
    );
  if (!uncategorized) {
    throw new Error(`No Uncategorized in the ${category.kind} tree`);
  }
  return { kind: "fallback", id: uncategorized.id };
}

interface FallbackOptions {
  ownerId: string;
  category: CategorySummary;
}

/**
 * How many current income and expense entries each category holds, keyed
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
      count: sql<number>`count(*)::int`,
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
