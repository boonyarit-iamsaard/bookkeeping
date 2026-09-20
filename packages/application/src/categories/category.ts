import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { databaseError } from "@bookkeeping/database/errors";
import { transactions } from "@bookkeeping/database/transactions";
import type {
  CategoryKind,
  CategorySummary,
} from "@bookkeeping/domain/categories";
import {
  CATEGORY_KINDS,
  GENERIC_ICON_ID,
  isCategoryIconId,
  MAX_CATEGORY_NAME_LENGTH,
  normalizeCategoryName,
  UNCATEGORIZED_NAME,
} from "@bookkeeping/domain/categories";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import { and, asc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  IdempotencyConflict,
  ValidatedPayload,
} from "../idempotency/idempotency";
import { executeIdempotentCreation } from "../idempotency/idempotency";
import { isUuid } from "../shared/identifier";
import { DEFAULT_CATEGORIES } from "./default-categories";

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

export interface UpdateCategoryInput
  extends CategoryRef,
    CategoryUpdateCommand {}

export type UpdateCategoryError =
  | { code: "category-not-found" }
  | { code: "blank-name" }
  | { code: "name-too-long" }
  | { code: "unknown-icon" }
  /** Same name, case-insensitively, already in scope (tree or parent). */
  | { code: "duplicate-name" }
  /** Uncategorized keeps its name; only its icon may change. */
  | { code: "protected" };

export interface CategoryUpdateCommand {
  name: string;
  iconId: string;
}

export type CategoryUpdateValidationError = Extract<
  UpdateCategoryError,
  { code: "blank-name" | "name-too-long" | "unknown-icon" }
>;

/** Normalizes and validates presentation data before the row is touched. */
export function validateCategoryUpdate(
  command: Readonly<CategoryUpdateCommand>,
): Result<CategoryUpdateCommand, CategoryUpdateValidationError> {
  const name = normalizeCategoryName(command.name);
  const invalidName = validateName(name, "name");
  if (invalidName) {
    return err({ code: invalidName.code });
  }
  if (!isCategoryIconId(command.iconId)) {
    return err({ code: "unknown-icon" });
  }
  return ok({ name, iconId: command.iconId });
}

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
  const validated = validateCategoryUpdate(input);
  if (!validated.ok) {
    return validated;
  }
  const { name, iconId } = validated.value;
  if (!isUuid(input.id)) {
    return err({ code: "category-not-found" });
  }
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .update(categories)
        .set({ name, iconId })
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

/** Unwinds the removal transaction once the category is found already gone. */
class AlreadyRemoved extends Error {}

type RemovalFallback =
  | { kind: "fallback"; id: string }
  | { kind: "has-children" };

/** The parent of a child; for a childless parent, its tree's Uncategorized. */
async function removalFallback(
  tx: Database,
  { ownerId, category }: Readonly<FallbackOptions>,
): Promise<RemovalFallback> {
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
 * Removes a category and moves its transactions to the fallback in one
 * transaction; refunds read their expense's category, so they follow by
 * themselves. Transaction rows are locked before the category row, the
 * same order edits take, so the two never deadlock. The restrict foreign
 * keys are the final word: a transaction or child committed meanwhile
 * fails the delete, and nothing is changed.
 */
export async function removeCategory(
  db: Database,
  input: Readonly<CategoryRef>,
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
      const outcome = await removalFallback(tx, {
        ownerId: input.ownerId,
        category,
      });
      if (outcome.kind === "has-children") {
        return err({ code: "has-children" });
      }
      const fallbackId = outcome.id;
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

/** Where a new child goes: under an existing parent, or under one created with it. */
export type ParentChoice =
  | { readonly existingId: string }
  | {
      readonly create: {
        readonly name: string;
        readonly iconId: string;
      };
    };

export interface CategoryCreationCommand {
  kind: CategoryKind;
  name: string;
  iconId: string;
  /** `null` creates a parent. */
  parent: ParentChoice | null;
}

export interface CreateCategoryInput extends CategoryCreationCommand {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  /** Client-generated; one key names one logical creation for this owner. */
  idempotencyKey: string;
}

export type CategoryErrorField =
  | "name"
  | "iconId"
  | "parentName"
  | "parentIconId";

export type CategoryCreationValidationError =
  | { code: "blank-name"; field: "name" | "parentName" }
  | { code: "name-too-long"; field: "name" | "parentName" }
  | { code: "unknown-icon"; field: "iconId" | "parentIconId" };

export type CreateCategoryError =
  | CategoryCreationValidationError
  /** Same name, case-insensitively, already in scope (tree or parent). */
  | { code: "duplicate-name"; field: "name" | "parentName" }
  | { code: "parent-not-found" }
  /** Trees have two levels: a child category cannot be a parent. */
  | { code: "parent-is-child" }
  /** Uncategorized has no children. */
  | { code: "parent-protected" }
  | IdempotencyConflict;

export interface CreateCategoryData {
  category: CategorySummary;
  /** Present when a missing parent was created in the same save. */
  createdParent?: CategorySummary;
}

export interface CreateCategoryOutcome extends CreateCategoryData {
  /** True when an earlier request with the same key already created it. */
  replayed: boolean;
}

/** The two shape rules every category name obeys, on creation or rename. */
type NameRejection = Extract<
  CategoryCreationValidationError,
  { code: "blank-name" | "name-too-long" }
>;

function validateName(
  name: string,
  field: "name" | "parentName",
): NameRejection | undefined {
  if (name.length === 0) {
    return { code: "blank-name", field };
  }
  if (name.length > MAX_CATEGORY_NAME_LENGTH) {
    return { code: "name-too-long", field };
  }
  return undefined;
}

/** Normalizes and validates command data before it can consume an idempotency key. */
export function validateCategoryCreation(
  input: Readonly<CategoryCreationCommand>,
): Result<CategoryCreationCommand, CategoryCreationValidationError> {
  const name = normalizeCategoryName(input.name);
  const invalidName = validateName(name, "name");
  if (invalidName) {
    return err(invalidName);
  }
  if (!isCategoryIconId(input.iconId)) {
    return err({ code: "unknown-icon", field: "iconId" });
  }

  if (input.parent && "create" in input.parent) {
    const parentName = normalizeCategoryName(input.parent.create.name);
    const invalidParentName = validateName(parentName, "parentName");
    if (invalidParentName) {
      return err(invalidParentName);
    }
    if (!isCategoryIconId(input.parent.create.iconId)) {
      return err({ code: "unknown-icon", field: "parentIconId" });
    }
    return ok({
      ...input,
      name,
      parent: {
        create: { name: parentName, iconId: input.parent.create.iconId },
      },
    });
  }

  return ok({ ...input, name });
}

const CATEGORY_CREATION_OPERATION = "categories.create";

/**
 * Creates a parent, a child under an existing parent, or a child together
 * with its missing parent, once per idempotency key.
 */
export async function createCategory(
  db: Database,
  input: Readonly<CreateCategoryInput>,
): Promise<Result<CreateCategoryOutcome, CreateCategoryError>> {
  const validated = validateCategoryCreation(input);
  if (!validated.ok) {
    return validated;
  }
  const command = validated.value;
  const outcome = await executeIdempotentCreation<
    CreateCategoryData,
    CreateCategoryError
  >(db, {
    ownerId: input.ownerId,
    operation: CATEGORY_CREATION_OPERATION,
    key: input.idempotencyKey,
    payload: categoryCreationPayload(command),
    create: (tx) =>
      createCategoryRows({ db: tx, ownerId: input.ownerId, command }),
  });
  if (!outcome.ok) {
    return err(outcome.error);
  }
  return ok({ ...outcome.value.result, replayed: outcome.value.replayed });
}

function categoryCreationPayload(
  command: Readonly<CategoryCreationCommand>,
): ValidatedPayload {
  const base = {
    kind: command.kind,
    name: command.name,
    iconId: command.iconId,
  };
  if (command.parent === null) {
    return { ...base, parent: null };
  }
  if ("existingId" in command.parent) {
    return { ...base, parent: { existingId: command.parent.existingId } };
  }
  return {
    ...base,
    parent: {
      create: {
        name: command.parent.create.name,
        iconId: command.parent.create.iconId,
      },
    },
  };
}

interface CreateCategoryRowsOptions {
  db: Database;
  ownerId: string;
  command: Readonly<CategoryCreationCommand>;
}

async function createCategoryRows({
  db,
  ownerId,
  command,
}: Readonly<CreateCategoryRowsOptions>): Promise<
  Result<CreateCategoryData, CreateCategoryError>
> {
  const createsParent = command.parent !== null && "create" in command.parent;
  try {
    let parent: CategorySummary | undefined;
    let createdParent: CategorySummary | undefined;
    if (command.parent && "existingId" in command.parent) {
      if (!isUuid(command.parent.existingId)) {
        return err({ code: "parent-not-found" });
      }
      // A share lock holds the parent's removal until this child lands, and a
      // removal already under way makes the parent vanish here.
      const [row] = await db
        .select(categorySummaryColumns)
        .from(categories)
        .where(
          and(
            eq(categories.id, command.parent.existingId),
            eq(categories.userId, ownerId),
            eq(categories.kind, command.kind),
          ),
        )
        .for("share");
      if (!row) {
        return err({ code: "parent-not-found" });
      }
      if (row.parentId !== null) {
        return err({ code: "parent-is-child" });
      }
      if (row.isProtected) {
        return err({ code: "parent-protected" });
      }
      parent = row;
    } else if (command.parent && "create" in command.parent) {
      createdParent = await insertCategory(db, {
        ownerId,
        kind: command.kind,
        name: command.parent.create.name,
        iconId: command.parent.create.iconId,
        parentId: null,
      });
      parent = createdParent;
    }

    const category = await insertCategory(db, {
      ownerId,
      kind: command.kind,
      name: command.name,
      iconId: command.iconId,
      parentId: parent?.id ?? null,
    });
    return ok(createdParent ? { category, createdParent } : { category });
  } catch (error) {
    const duplicate = duplicateNameField(error, {
      createdParent: createsParent,
    });
    if (duplicate) {
      return err({ code: "duplicate-name", field: duplicate });
    }
    throw error;
  }
}

interface InsertCategoryValues {
  ownerId: string;
  kind: CategoryKind;
  name: string;
  iconId: string;
  parentId: string | null;
}

/** Appends after the last sibling in picker order. */
async function insertCategory(
  db: Database,
  { ownerId, kind, name, iconId, parentId }: Readonly<InsertCategoryValues>,
): Promise<CategorySummary> {
  const scope = parentId
    ? eq(categories.parentId, parentId)
    : and(
        eq(categories.userId, ownerId),
        eq(categories.kind, kind),
        isNull(categories.parentId),
      );
  const [last] = await db
    .select({
      sortOrder: sql<number>`coalesce(max(${categories.sortOrder}), 0)`,
    })
    .from(categories)
    .where(scope);
  const [row] = await db
    .insert(categories)
    .values({
      userId: ownerId,
      kind,
      parentId,
      name,
      iconId,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    })
    .returning(categorySummaryColumns);
  if (!row) {
    throw new Error("Category insert returned no row");
  }
  return row;
}

const UNIQUE_VIOLATION = "23505";
const PARENT_NAME_INDEX = "categories_parent_name_unique";
const CHILD_NAME_INDEX = "categories_child_name_unique";

function duplicateNameField(
  error: unknown,
  { createdParent }: Readonly<{ createdParent: boolean }>,
): "name" | "parentName" | undefined {
  const cause = databaseError(error);
  if (cause?.code !== UNIQUE_VIOLATION) {
    return undefined;
  }
  if (cause.constraint === CHILD_NAME_INDEX) {
    return "name";
  }
  if (cause.constraint === PARENT_NAME_INDEX) {
    return createdParent ? "parentName" : "name";
  }
  return undefined;
}

/** Whether a write tripped either scoped name index: tree-level or per-parent. */
function isScopedNameViolation(error: unknown): boolean {
  const cause = databaseError(error);
  return (
    cause?.code === UNIQUE_VIOLATION &&
    (cause.constraint === PARENT_NAME_INDEX ||
      cause.constraint === CHILD_NAME_INDEX)
  );
}

export interface ProvisioningOutcome {
  /** The trees this call created; empty when the owner was already provisioned. */
  seededKinds: readonly CategoryKind[];
}

/**
 * Gives the owner an editable copy of the default trees, once. Each tree is
 * seeded only while it has no protected Uncategorized; an existing tree is
 * left exactly as the user has customized it. Both trees land in one
 * transaction, serialized per owner so concurrent calls cannot both seed.
 */
export async function initializeDefaultCategories(
  db: Database,
  ownerId: string,
): Promise<ProvisioningOutcome> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ownerId}))`);
    const seededKinds: CategoryKind[] = [];
    for (const kind of CATEGORY_KINDS) {
      const [existing] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.userId, ownerId),
            eq(categories.kind, kind),
            eq(categories.isProtected, true),
          ),
        )
        .limit(1);
      if (existing) {
        continue;
      }
      await seedTree(tx, { ownerId, kind });
      seededKinds.push(kind);
    }
    return { seededKinds };
  });
}

interface SeedTreeOptions {
  ownerId: string;
  kind: CategoryKind;
}

/** Runs inside the provisioning transaction, after the owner lock is held. */
async function seedTree(
  tx: Database,
  { ownerId, kind }: Readonly<SeedTreeOptions>,
) {
  await tx.insert(categories).values({
    userId: ownerId,
    kind,
    name: UNCATEGORIZED_NAME,
    iconId: GENERIC_ICON_ID,
    isProtected: true,
    sortOrder: 0,
  });
  const defaults = DEFAULT_CATEGORIES[kind];
  for (const [index, parent] of defaults.entries()) {
    const [row] = await tx
      .insert(categories)
      .values({
        userId: ownerId,
        kind,
        name: parent.name,
        iconId: parent.iconId,
        sortOrder: index + 1,
      })
      .returning({ id: categories.id });
    if (!row) {
      throw new Error("Category insert returned no row");
    }
    const children = parent.children ?? [];
    if (children.length > 0) {
      await tx.insert(categories).values(
        children.map((child, childIndex) => ({
          userId: ownerId,
          kind,
          parentId: row.id,
          name: child.name,
          iconId: child.iconId,
          sortOrder: childIndex,
        })),
      );
    }
  }
}
