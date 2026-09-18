import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
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
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import * as z from "zod";
import type {
  CreationResultCodec,
  IdempotencyConflict,
  StoredCreationResult,
  ValidatedPayload,
} from "../idempotency/idempotency";
import { executeIdempotentCreation } from "../idempotency/idempotency";
import { DEFAULT_CATEGORIES } from "./default-categories";

/** Both trees, parents before their children, in picker order. */
export async function listCategories(
  db: Readonly<Database>,
  ownerId: string,
): Promise<readonly CategorySummary[]> {
  const rows = await db
    .select({
      id: categories.id,
      kind: categories.kind,
      parentId: categories.parentId,
      name: categories.name,
      iconId: categories.iconId,
      isProtected: categories.isProtected,
    })
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
export type NameRejection = Extract<
  CategoryCreationValidationError,
  { code: "blank-name" | "name-too-long" }
>;

export function validateName(
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

const categorySummarySchema = z.object({
  id: z.uuid(),
  kind: z.enum(CATEGORY_KINDS),
  parentId: z.uuid().nullable(),
  name: z.string(),
  iconId: z.string(),
  isProtected: z.boolean(),
});

const storedCategoryResultSchema = z.object({
  category: categorySummarySchema,
  createdParent: categorySummarySchema.optional(),
});

const categoryResultCodec: CreationResultCodec<CreateCategoryData> = {
  encode(result): StoredCreationResult {
    const encoded: {
      category: StoredCreationResult;
      createdParent?: StoredCreationResult;
    } = {
      category: encodeCategorySummary(result.category),
    };
    if (result.createdParent) {
      encoded.createdParent = encodeCategorySummary(result.createdParent);
    }
    return encoded;
  },
  decode(value) {
    return storedCategoryResultSchema.parse(value);
  },
};

function encodeCategorySummary(
  category: Readonly<CategorySummary>,
): StoredCreationResult {
  return {
    id: category.id,
    kind: category.kind,
    parentId: category.parentId,
    name: category.name,
    iconId: category.iconId,
    isProtected: category.isProtected,
  };
}

const CATEGORY_CREATION_OPERATION = "categories.create";

/** PostgreSQL rejects malformed UUIDs before the application can query them. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    resultCodec: categoryResultCodec,
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
      if (!UUID_PATTERN.test(command.parent.existingId)) {
        return err({ code: "parent-not-found" });
      }
      // A share lock holds the parent's removal until this child lands, and a
      // removal already under way makes the parent vanish here.
      const [row] = await db
        .select(summaryColumns)
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

export const summaryColumns = {
  id: categories.id,
  kind: categories.kind,
  parentId: categories.parentId,
  name: categories.name,
  iconId: categories.iconId,
  isProtected: categories.isProtected,
};

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
    .returning(summaryColumns);
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
export function isScopedNameViolation(error: unknown): boolean {
  const cause = databaseError(error);
  return (
    cause?.code === UNIQUE_VIOLATION &&
    (cause.constraint === PARENT_NAME_INDEX ||
      cause.constraint === CHILD_NAME_INDEX)
  );
}

interface DatabaseErrorShape {
  code: string;
  constraint: string | undefined;
}

/** Drizzle wraps driver errors; the Postgres detail is on `cause`. */
export function databaseError(error: unknown): DatabaseErrorShape | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const candidate: unknown = error.cause instanceof Error ? error.cause : error;
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !("code" in candidate) ||
    typeof candidate.code !== "string"
  ) {
    return undefined;
  }
  const constraint =
    "constraint" in candidate && typeof candidate.constraint === "string"
      ? candidate.constraint
      : undefined;
  return { code: candidate.code, constraint };
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
