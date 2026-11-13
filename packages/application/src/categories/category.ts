import {
  CATEGORY_CHILD_NAME_INDEX,
  CATEGORY_PARENT_ID_FK,
  CATEGORY_PARENT_NAME_INDEX,
  categories,
} from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import {
  databaseError,
  FOREIGN_KEY_VIOLATION,
  RESTRICT_VIOLATION,
  UNIQUE_VIOLATION,
} from "@bookkeeping/database/errors";
import {
  TRANSACTION_CATEGORY_FK,
  transactions,
} from "@bookkeeping/database/transactions";
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
import { and, eq, isNull, or, sql } from "drizzle-orm";
import type {
  IdempotentCreationRequest,
  IdempotentCreator,
} from "../idempotency/idempotency";
import { defineIdempotentCreation } from "../idempotency/idempotency";
import { isUuid } from "../shared/identifier";
import type { NotFound } from "../shared/not-found";
import { notFound } from "../shared/not-found";
import { rejected } from "../shared/rejection";
import type { CategoryRef } from "./category-reads";
import { categorySummaryColumns } from "./category-reads";
import type { CategoryRejected, CategoryRejection } from "./category-rejection";
import { DEFAULT_CATEGORIES } from "./default-categories";

export type {
  CategoryField,
  CategoryRejected,
  CategoryRejection,
} from "./category-rejection";

export interface UpdateCategoryInput
  extends CategoryRef,
    CategoryUpdateCommand {}

export type UpdateCategoryError = NotFound | CategoryRejected;

export interface CategoryUpdateCommand {
  name: string;
  iconId: string;
}

/** Normalizes and validates presentation data before the row is touched. */
export function validateCategoryUpdate(
  command: Readonly<CategoryUpdateCommand>,
): Result<CategoryUpdateCommand, CategoryRejected> {
  const name = normalizeCategoryName(command.name);
  const invalidName = validateName(name, "name");
  if (invalidName) {
    return err(rejected(invalidName));
  }
  if (!isCategoryIconId(command.iconId)) {
    return err(rejected({ code: "unknown-icon", field: "iconId" }));
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
    return err(notFound());
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
      return err(
        current?.isProtected
          ? rejected({ code: "protected", field: "name" })
          : notFound(),
      );
    });
  } catch (error) {
    if (isScopedNameViolation(error)) {
      return err(rejected({ code: "duplicate-name", field: "name" }));
    }
    throw error;
  }
}

export type RemoveCategoryError =
  | NotFound
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

/** Unwinds the removal once the category is found already gone. */
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
 * transaction; refunds follow their expense's category. Its locks follow
 * the global order in `transactions/transaction-judgement.ts`. The restrict
 * foreign keys are the final word: a transaction or child committed
 * meanwhile fails the delete and changes nothing.
 */
export async function removeCategory(
  db: Database,
  input: Readonly<CategoryRef>,
): Promise<Result<RemoveCategoryOutcome, RemoveCategoryError>> {
  if (!isUuid(input.id)) {
    return err(notFound());
  }
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
        return err(notFound());
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
      return err(notFound());
    }
    const cause = databaseError(error);
    // A restrict foreign key refuses the delete; a deferred one reports a foreign key violation.
    if (
      cause &&
      (cause.code === RESTRICT_VIOLATION ||
        cause.code === FOREIGN_KEY_VIOLATION)
    ) {
      if (cause.constraint === CATEGORY_PARENT_ID_FK) {
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

export interface CreateCategoryInput
  extends CategoryCreationCommand,
    IdempotentCreationRequest {}

export interface CreateCategoryData {
  category: CategorySummary;
  /** Present when a missing parent was created in the same save. */
  createdParent?: CategorySummary;
}

/** The two shape rules every category name obeys, on creation or rename. */
type NameRejection = Extract<
  CategoryRejection,
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
): Result<CategoryCreationCommand, CategoryRejected> {
  const name = normalizeCategoryName(input.name);
  const invalidName = validateName(name, "name");
  if (invalidName) {
    return err(rejected(invalidName));
  }
  if (!isCategoryIconId(input.iconId)) {
    return err(rejected({ code: "unknown-icon", field: "iconId" }));
  }

  if (input.parent && "create" in input.parent) {
    const parentName = normalizeCategoryName(input.parent.create.name);
    const invalidParentName = validateName(parentName, "parentName");
    if (invalidParentName) {
      return err(rejected(invalidParentName));
    }
    if (!isCategoryIconId(input.parent.create.iconId)) {
      return err(rejected({ code: "unknown-icon", field: "parentIconId" }));
    }
    return ok({
      kind: input.kind,
      name,
      iconId: input.iconId,
      parent: {
        create: { name: parentName, iconId: input.parent.create.iconId },
      },
    });
  }

  return ok({
    kind: input.kind,
    name,
    iconId: input.iconId,
    parent:
      input.parent === null ? null : { existingId: input.parent.existingId },
  });
}

/**
 * Creates a parent, a child under an existing parent, or a child together
 * with its missing parent, once per idempotency key.
 */
export const createCategory: IdempotentCreator<
  CreateCategoryInput,
  CreateCategoryData,
  CategoryRejected
> = defineIdempotentCreation({
  operation: "categories.create",
  prepare: (input: Readonly<CreateCategoryInput>) =>
    validateCategoryCreation(input),
  insert: (tx, { ownerId, command }) =>
    createCategoryRows({ db: tx, ownerId, command }),
});

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
  Result<CreateCategoryData, CategoryRejected>
> {
  const resolved = await resolveParent({ db, ownerId, command });
  if (!resolved.ok) {
    return resolved;
  }
  let category: CategorySummary;
  try {
    category = await insertCategory(db, {
      ownerId,
      kind: command.kind,
      name: command.name,
      iconId: command.iconId,
      parentId:
        resolved.value.kind === "none" ? null : resolved.value.parent.id,
    });
  } catch (error) {
    if (isScopedNameViolation(error)) {
      return err(rejected({ code: "duplicate-name", field: "name" }));
    }
    throw error;
  }
  return ok(
    resolved.value.kind === "created"
      ? { category, createdParent: resolved.value.parent }
      : { category },
  );
}

type ParentResolutionError = CategoryRejected;

/**
 * Where the new category lands: top level, under a locked existing row, or
 * under a row this same save created.
 */
type ResolvedParent =
  | { kind: "none" }
  | { kind: "existing"; parent: CategorySummary }
  | { kind: "created"; parent: CategorySummary };

/** Locks an existing parent or inserts the requested one, per the command. */
async function resolveParent({
  db,
  ownerId,
  command,
}: Readonly<CreateCategoryRowsOptions>): Promise<
  Result<ResolvedParent, ParentResolutionError>
> {
  if (command.parent === null) {
    return ok({ kind: "none" });
  }
  if ("existingId" in command.parent) {
    const locked = await lockParent({
      db,
      ownerId,
      kind: command.kind,
      existingId: command.parent.existingId,
    });
    return locked.ok ? ok({ kind: "existing", parent: locked.value }) : locked;
  }
  try {
    const parent = await insertCategory(db, {
      ownerId,
      kind: command.kind,
      name: command.parent.create.name,
      iconId: command.parent.create.iconId,
      parentId: null,
    });
    return ok({ kind: "created", parent });
  } catch (error) {
    if (isScopedNameViolation(error)) {
      return err(rejected({ code: "duplicate-name", field: "parentName" }));
    }
    throw error;
  }
}

interface LockParentOptions {
  db: Database;
  ownerId: string;
  kind: CategoryKind;
  existingId: string;
}

/**
 * A share lock holds the parent's removal until this child lands, and a
 * removal already under way makes the parent vanish here.
 */
async function lockParent({
  db,
  ownerId,
  kind,
  existingId,
}: Readonly<LockParentOptions>): Promise<
  Result<CategorySummary, ParentResolutionError>
> {
  if (!isUuid(existingId)) {
    return err(rejected({ code: "parent-not-found", field: "parent" }));
  }
  const [row] = await db
    .select(categorySummaryColumns)
    .from(categories)
    .where(
      and(
        eq(categories.id, existingId),
        eq(categories.userId, ownerId),
        eq(categories.kind, kind),
      ),
    )
    .for("share");
  if (!row) {
    return err(rejected({ code: "parent-not-found", field: "parent" }));
  }
  if (row.parentId !== null) {
    return err(rejected({ code: "parent-is-child", field: "parent" }));
  }
  if (row.isProtected) {
    return err(rejected({ code: "parent-protected", field: "parent" }));
  }
  return ok(row);
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

/** Whether a write tripped either scoped name index: tree-level or per-parent. */
function isScopedNameViolation(error: unknown): boolean {
  const cause = databaseError(error);
  return (
    cause?.code === UNIQUE_VIOLATION &&
    (cause.constraint === CATEGORY_PARENT_NAME_INDEX ||
      cause.constraint === CATEGORY_CHILD_NAME_INDEX)
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
    const existing = await tx
      .select({ kind: categories.kind })
      .from(categories)
      .where(
        and(eq(categories.userId, ownerId), eq(categories.isProtected, true)),
      );
    const seededKinds = CATEGORY_KINDS.filter(
      (kind) => !existing.some((tree) => tree.kind === kind),
    );
    if (seededKinds.length > 0) {
      await seedTrees(tx, { ownerId, kinds: seededKinds });
    }
    return { seededKinds };
  });
}

interface SeedTreesOptions {
  ownerId: string;
  kinds: readonly CategoryKind[];
}

/** Runs inside the provisioning transaction, after the owner lock is held. */
async function seedTrees(
  tx: Database,
  { ownerId, kinds }: Readonly<SeedTreesOptions>,
) {
  const parents = await tx
    .insert(categories)
    .values(
      kinds.flatMap((kind) =>
        [
          { name: UNCATEGORIZED_NAME, iconId: GENERIC_ICON_ID },
          ...DEFAULT_CATEGORIES[kind],
        ].map(({ name, iconId }, sortOrder) => ({
          userId: ownerId,
          kind,
          name,
          iconId,
          isProtected: sortOrder === 0,
          sortOrder,
        })),
      ),
    )
    .returning({
      id: categories.id,
      kind: categories.kind,
      sortOrder: categories.sortOrder,
    });
  // Parent sort order is its catalog index plus one; zero is Uncategorized.
  const children = parents.flatMap((parent) =>
    (DEFAULT_CATEGORIES[parent.kind][parent.sortOrder - 1]?.children ?? []).map(
      (child, index) => ({
        userId: ownerId,
        kind: parent.kind,
        parentId: parent.id,
        name: child.name,
        iconId: child.iconId,
        sortOrder: index,
      }),
    ),
  );
  if (children.length > 0) {
    await tx.insert(categories).values(children);
  }
}
