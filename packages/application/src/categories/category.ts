import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import type { CategoryKind } from "@bookkeeping/domain/categories";
import {
  CATEGORY_KINDS,
  GENERIC_ICON_ID,
  UNCATEGORIZED_NAME,
} from "@bookkeeping/domain/categories";
import { and, eq, sql } from "drizzle-orm";
import { DEFAULT_CATEGORIES } from "./default-categories";

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
