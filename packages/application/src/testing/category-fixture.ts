import { randomUUID } from "node:crypto";
import type { Database } from "@bookkeeping/database/connection";
import type { CreateCategoryInput } from "../categories/category";
import { createCategory } from "../categories/category";

export type CategoryFixtureInput = Omit<CreateCategoryInput, "idempotencyKey">;

/** Creates a category through the shared operation under a fresh key. */
export function createCategoryForTest(
  db: Database,
  input: Readonly<CategoryFixtureInput>,
) {
  return createCategory(db, { ...input, idempotencyKey: randomUUID() });
}
