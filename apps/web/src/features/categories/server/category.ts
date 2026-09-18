import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import type {
  CategoryKind,
  CategorySummary,
} from "@bookkeeping/domain/categories";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  MAX_CATEGORY_NAME_LENGTH,
  normalizeCategoryName,
} from "@/features/categories/category-name";
import { isIconId } from "@/features/categories/icons";

/** Where a new child goes: under an existing parent, or under one created with it. */
export type ParentChoice =
  | { existingId: string }
  | { create: { name: string; iconId: string } };

export interface CreateCategoryInput {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  kind: CategoryKind;
  name: string;
  /** A catalog id; the picker guarantees a generic preselection. */
  iconId: string;
  /** `null` creates a parent. */
  parent: ParentChoice | null;
}

/** Which of the two names or icons a rejection is about. */
export type CategoryErrorField =
  | "name"
  | "iconId"
  | "parentName"
  | "parentIconId";

export type CreateCategoryError =
  | { code: "blank-name"; field: "name" | "parentName" }
  | { code: "name-too-long"; field: "name" | "parentName" }
  | { code: "unknown-icon"; field: "iconId" | "parentIconId" }
  /** Same name, case-insensitively, already in scope (tree or parent). */
  | { code: "duplicate-name"; field: "name" | "parentName" }
  | { code: "parent-not-found" }
  /** Trees have two levels: a child category cannot be a parent. */
  | { code: "parent-is-child" }
  /** Uncategorized has no children. */
  | { code: "parent-protected" };

export interface CreateCategoryOutcome {
  category: CategorySummary;
  /** Present when a missing parent was created in the same save. */
  createdParent?: CategorySummary;
}

const UNIQUE_VIOLATION = "23505";
const PARENT_NAME_INDEX = "categories_parent_name_unique";
const CHILD_NAME_INDEX = "categories_child_name_unique";

/**
 * Creates a parent, a child under an existing parent, or a child together
 * with its missing parent, in one transaction. Scoped uniqueness is enforced
 * by the partial unique indexes, so two concurrent saves of the same name
 * cannot both succeed; the loser is reported as a duplicate.
 */
export async function createCategory(
  db: Database,
  input: Readonly<CreateCategoryInput>,
): Promise<Result<CreateCategoryOutcome, CreateCategoryError>> {
  const name = normalizeCategoryName(input.name);
  const invalidName = validateName(name, "name");
  if (invalidName) {
    return err(invalidName);
  }
  if (!isIconId(input.iconId)) {
    return err({ code: "unknown-icon", field: "iconId" });
  }
  const newParent =
    input.parent && "create" in input.parent ? input.parent.create : undefined;
  const parentName = newParent
    ? normalizeCategoryName(newParent.name)
    : undefined;
  if (newParent && parentName !== undefined) {
    const invalidParentName = validateName(parentName, "parentName");
    if (invalidParentName) {
      return err(invalidParentName);
    }
    if (!isIconId(newParent.iconId)) {
      return err({ code: "unknown-icon", field: "parentIconId" });
    }
  }

  try {
    return await db.transaction(async (tx) => {
      let parent: CategorySummary | undefined;
      let createdParent: CategorySummary | undefined;
      if (input.parent && "existingId" in input.parent) {
        // A share lock holds the parent's removal until this child lands,
        // and a removal already under way makes the parent vanish here.
        const [row] = await tx
          .select(summaryColumns)
          .from(categories)
          .where(
            and(
              eq(categories.id, input.parent.existingId),
              eq(categories.userId, input.ownerId),
              eq(categories.kind, input.kind),
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
      } else if (newParent && parentName !== undefined) {
        createdParent = await insertCategory(tx, {
          ownerId: input.ownerId,
          kind: input.kind,
          name: parentName,
          iconId: newParent.iconId,
          parentId: null,
        });
        parent = createdParent;
      }
      const category = await insertCategory(tx, {
        ownerId: input.ownerId,
        kind: input.kind,
        name,
        iconId: input.iconId,
        parentId: parent?.id ?? null,
      });
      return ok(createdParent ? { category, createdParent } : { category });
    });
  } catch (error) {
    const duplicate = duplicateNameField(error, { createdParent: !!newParent });
    if (duplicate) {
      return err({ code: "duplicate-name", field: duplicate });
    }
    throw error;
  }
}

/** The two shape rules every category name obeys, on creation or rename. */
export type NameRejection = Extract<
  CreateCategoryError,
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

/**
 * Maps a unique-index violation to the name it was about. The parent-name
 * index fires for the created parent when there is one, otherwise for a
 * new top-level category; the child-name index is always the child.
 */
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
