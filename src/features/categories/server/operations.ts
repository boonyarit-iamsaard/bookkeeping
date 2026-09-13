import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "@/core/database/database";
import { categories } from "@/core/database/schema/categories";
import type { CategoryKind } from "@/core/database/schema/category-kind";
import { CATEGORY_KINDS } from "@/core/database/schema/category-kind";
import { DEFAULT_CATEGORIES } from "@/features/categories/defaults";
import { GENERIC_ICON_ID } from "@/features/categories/icons";

export const UNCATEGORIZED_NAME = "Uncategorized";

export interface CategorySummary {
  id: string;
  kind: CategoryKind;
  parentId: string | null;
  name: string;
  iconId: string;
  isProtected: boolean;
}

/**
 * Gives the owner an editable copy of the default trees, once. Each tree is
 * seeded only while it has no protected Uncategorized; an existing tree is
 * left exactly as the user has customized it. Serialized per owner so two
 * concurrent first visits cannot both seed.
 */
export async function initializeDefaultCategories(
  db: Database,
  ownerId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ownerId}))`);
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
    }
  });
}

interface SeedTreeOptions {
  ownerId: string;
  kind: CategoryKind;
}

async function seedTree(
  db: Database,
  { ownerId, kind }: Readonly<SeedTreeOptions>,
) {
  await db.insert(categories).values({
    userId: ownerId,
    kind,
    name: UNCATEGORIZED_NAME,
    iconId: GENERIC_ICON_ID,
    isProtected: true,
    sortOrder: 0,
  });
  const defaults = DEFAULT_CATEGORIES[kind];
  for (const [index, parent] of defaults.entries()) {
    const [row] = await db
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
      await db.insert(categories).values(
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

/** Both trees, parents before their children, in picker order. */
export async function listCategories(
  db: Database,
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
