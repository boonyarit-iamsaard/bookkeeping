import { randomUUID } from "node:crypto";
import type {
  CreateCategoryError,
  CreateCategoryInput,
  CreateCategoryOutcome,
} from "@bookkeeping/application/categories";
import { createCategory } from "@bookkeeping/application/categories";
import type { Database } from "@bookkeeping/database/connection";
import type { Result } from "@bookkeeping/domain/result";

export type CategoryFixtureInput = Omit<CreateCategoryInput, "idempotencyKey">;

/** Creates an isolated category fixture through the shared application operation. */
export function createCategoryForTest(
  db: Database,
  input: Readonly<CategoryFixtureInput>,
): Promise<Result<CreateCategoryOutcome, CreateCategoryError>> {
  return createCategory(db, { ...input, idempotencyKey: randomUUID() });
}
