import { randomUUID } from "node:crypto";
import type { Database } from "@bookkeeping/database/connection";
import type { Result } from "@bookkeeping/domain/result";
import type {
  CategoryRejected,
  CreateCategoryData,
  CreateCategoryInput,
} from "../categories/category";
import { createCategory } from "../categories/category";
import type { IdempotencyConflict } from "../idempotency/idempotency";

export type CategoryFixtureInput = Omit<CreateCategoryInput, "idempotencyKey">;

/** Creates a category through the shared operation under a fresh key. */
export function createCategoryForTest(
  db: Database,
  input: Readonly<CategoryFixtureInput>,
): Promise<Result<CreateCategoryData, CategoryRejected | IdempotencyConflict>> {
  return createCategory(db, { ...input, idempotencyKey: randomUUID() });
}
