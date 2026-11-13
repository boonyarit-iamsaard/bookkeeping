import type { Database } from "@bookkeeping/database/connection";
import { createTestUser } from "@bookkeeping/database/testing";
import type { CategoryKind } from "@bookkeeping/domain/categories";
import { initializeDefaultCategories } from "../categories/category";
import { listCategories } from "../categories/category-reads";
import { DEFAULT_CATEGORIES } from "../categories/default-categories";

/** The shared envelope of one refused input. */
export function refusal(code: string, field: string) {
  return { code: "rejected", rejections: [{ code, field }] };
}

export function refused(code: string, field: string) {
  return { ok: false, error: refusal(code, field) };
}

export async function setupOwner(db: Database) {
  const owner = await createTestUser(db);
  await initializeDefaultCategories(db, owner.id);
  const tree = await listCategories(db, owner.id);
  function find(kind: CategoryKind, name: string) {
    const found = tree.find((c) => c.kind === kind && c.name === name);
    if (!found) {
      throw new Error(`Missing ${kind} category ${name}`);
    }
    return found;
  }
  return { owner, find };
}

export function catalogSize(kind: CategoryKind) {
  return DEFAULT_CATEGORIES[kind].reduce(
    (count, parent) => count + 1 + (parent.children?.length ?? 0),
    1, // Uncategorized
  );
}
