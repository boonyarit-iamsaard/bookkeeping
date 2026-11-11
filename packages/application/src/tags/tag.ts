import type { Database } from "@bookkeeping/database/connection";
import { databaseError } from "@bookkeeping/database/errors";
import { tags, transactionTags } from "@bookkeeping/database/tags";
import { transactions } from "@bookkeeping/database/transactions";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import type { TagSummary, TransactionTag } from "@bookkeeping/domain/tags";
import {
  MAX_TAG_NAME_LENGTH,
  normalizeTagName,
} from "@bookkeeping/domain/tags";
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import type { IdempotentCreator } from "../idempotency/idempotency";
import { defineIdempotentCreation } from "../idempotency/idempotency";
import { isUuid } from "../shared/identifier";
import type { NotFound } from "../shared/not-found";
import { notFound } from "../shared/not-found";
import type { Rejected } from "../shared/rejection";
import { rejected } from "../shared/rejection";

const UNIQUE_VIOLATION = "23505";
const TAG_NAME_INDEX = "tags_user_name_unique";

const tagColumns = { id: tags.id, name: tags.name };

/** The inputs a tag command can refuse: a create and a rename carry only the name. */
export type TagField = "name";

/** Every rule rejection a tag command reports; each names the input it refuses. */
export type TagRejection =
  | { code: "blank-name"; field: "name" }
  | { code: "name-too-long"; field: "name" }
  /** The owner already has a tag of this name, ignoring case. */
  | { code: "duplicate-name"; field: "name" };

/** The refused inputs of a tag command, in the shared envelope. */
export type TagRejected = Rejected<TagRejection>;

/** The trimmed name, or why no tag may carry it. */
function validateTagName(raw: string): Result<string, TagRejected> {
  const name = normalizeTagName(raw);
  if (name.length === 0) {
    return err(rejected({ code: "blank-name", field: "name" }));
  }
  if (name.length > MAX_TAG_NAME_LENGTH) {
    return err(rejected({ code: "name-too-long", field: "name" }));
  }
  return ok(name);
}

function isTagNameViolation(error: unknown): boolean {
  const cause = databaseError(error);
  return (
    cause?.code === UNIQUE_VIOLATION && cause.constraint === TAG_NAME_INDEX
  );
}

/**
 * The owner's tags in suggestion order: most recently put on a current
 * transaction first, then most used, then by name; unused tags last.
 */
export async function listTags(
  db: Database,
  ownerId: string,
): Promise<readonly TagSummary[]> {
  // Only current transactions count; a deleted one's links stay until the tag goes.
  const lastUsedAt =
    sql<Date | null>`max(case when ${transactions.id} is not null then ${transactionTags.createdAt} end)`.mapWith(
      transactionTags.createdAt,
    );
  const transactionCount = sql<number>`count(${transactions.id})::int`;
  const rows = await db
    .select({ ...tagColumns, transactionCount, lastUsedAt })
    .from(tags)
    .leftJoin(transactionTags, eq(transactionTags.tagId, tags.id))
    .leftJoin(
      transactions,
      and(
        eq(transactions.id, transactionTags.transactionId),
        isNull(transactions.deletedAt),
      ),
    )
    .where(eq(tags.userId, ownerId))
    .groupBy(tags.id)
    .orderBy(
      sql`${lastUsedAt} desc nulls last`,
      desc(transactionCount),
      asc(sql`lower(${tags.name})`),
      asc(tags.id),
    );
  return rows;
}

export interface CreateTagInput {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  /** Client-generated; one key names one logical creation for this owner. */
  idempotencyKey: string;
  name: string;
}

/** Creates one tag per idempotency key; a refused name never consumes the key. */
export const createTag: IdempotentCreator<
  CreateTagInput,
  TransactionTag,
  TagRejected
> = defineIdempotentCreation({
  operation: "tags.create",
  prepare: (input: Readonly<CreateTagInput>) => {
    const name = validateTagName(input.name);
    return name.ok ? ok({ name: name.value }) : name;
  },
  insert: async (
    tx,
    { ownerId, command },
  ): Promise<Result<TransactionTag, TagRejected>> => {
    try {
      const [row] = await tx
        .insert(tags)
        .values({ userId: ownerId, name: command.name })
        .returning(tagColumns);
      if (!row) {
        throw new Error("Tag insert returned no row");
      }
      return ok(row);
    } catch (error) {
      if (isTagNameViolation(error)) {
        return err(rejected({ code: "duplicate-name", field: "name" }));
      }
      throw error;
    }
  },
});

export interface TagRef {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  id: string;
}

export interface RenameTagInput extends TagRef {
  name: string;
}

export type RenameTagError = NotFound | TagRejected;

/**
 * Renames one of the owner's tags. Renaming to the name another of the
 * owner's tags holds, ignoring case, merges this tag into that one: every
 * transaction carrying either carries the survivor, which takes the name as
 * typed, and the renamed tag goes. The survivor is returned, so a merge
 * answers a different id. Neither writes Change history on the transactions.
 */
export async function renameTag(
  db: Database,
  input: Readonly<RenameTagInput>,
): Promise<Result<TransactionTag, RenameTagError>> {
  const name = validateTagName(input.name);
  if (!name.ok) {
    return name;
  }
  if (!isUuid(input.id)) {
    return err(notFound());
  }
  try {
    return await renameOrMerge(db, { ...input, name: name.value });
  } catch (error) {
    // A concurrent create took the name after it was looked up: the tag now
    // exists, so the second attempt merges into it.
    if (isTagNameViolation(error)) {
      return renameOrMerge(db, { ...input, name: name.value });
    }
    throw error;
  }
}

/** One locked attempt at a rename whose name is already valid. */
function renameOrMerge(db: Database, input: Readonly<RenameTagInput>) {
  return db.transaction(
    async (tx): Promise<Result<TransactionTag, RenameTagError>> => {
      const [renamed] = await tx
        .select(tagColumns)
        .from(tags)
        .where(and(eq(tags.id, input.id), eq(tags.userId, input.ownerId)))
        .for("update");
      if (!renamed) {
        return err(notFound());
      }
      const [survivor] = await tx
        .select(tagColumns)
        .from(tags)
        .where(
          and(
            eq(tags.userId, input.ownerId),
            // The unique index's own comparison, whatever the collation.
            sql`lower(${tags.name}) = lower(${input.name})`,
            ne(tags.id, renamed.id),
          ),
        )
        .for("update");
      if (survivor) {
        await tx
          .insert(transactionTags)
          .select(
            tx
              .select({
                transactionId: transactionTags.transactionId,
                tagId: sql<string>`${survivor.id}::uuid`.as("tag_id"),
                createdAt: transactionTags.createdAt,
              })
              .from(transactionTags)
              .where(eq(transactionTags.tagId, renamed.id)),
          )
          .onConflictDoNothing();
        await tx.delete(tags).where(eq(tags.id, renamed.id));
      }
      const [row] = await tx
        .update(tags)
        .set({ name: input.name })
        .where(eq(tags.id, (survivor ?? renamed).id))
        .returning(tagColumns);
      if (!row) {
        throw new Error("Renamed tag could not be read back");
      }
      return ok(row);
    },
  );
}

export type DeleteTagError = NotFound;

/**
 * Deletes one of the owner's tags and takes it off every transaction that
 * carries it. The transactions stay, without Change history.
 */
export async function deleteTag(
  db: Database,
  { ownerId, id }: Readonly<TagRef>,
): Promise<Result<{ id: string }, DeleteTagError>> {
  if (!isUuid(id)) {
    return err(notFound());
  }
  const [row] = await db
    .delete(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, ownerId)))
    .returning({ id: tags.id });
  return row ? ok(row) : err(notFound());
}
