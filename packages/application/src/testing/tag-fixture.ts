import { randomUUID } from "node:crypto";
import type { Database } from "@bookkeeping/database/connection";
import { createTag } from "../tags/tag";

export interface TagFixture {
  ownerId: string;
  name: string;
}

/** Creates a tag through the shared operation under a fresh key and returns its id. */
export async function createTagForTest(
  db: Database,
  fixture: Readonly<TagFixture>,
): Promise<string> {
  const created = await createTag(db, {
    ownerId: fixture.ownerId,
    idempotencyKey: randomUUID(),
    name: fixture.name,
  });
  if (!created.ok) {
    throw new Error(`Expected the tag to save, got ${created.error.code}`);
  }
  return created.value.id;
}
