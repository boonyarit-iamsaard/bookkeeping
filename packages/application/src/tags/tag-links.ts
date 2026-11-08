import type { Database } from "@bookkeeping/database/connection";
import { tags, transactionTags } from "@bookkeeping/database/tags";
import type { TransactionTag } from "@bookkeeping/domain/tags";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { isUuid } from "../shared/identifier";

/** Each named tag once, in a stable order, so equal choices compare and fingerprint alike. */
export function normalizeTagIds(tagIds: readonly string[]): string[] {
  return [...new Set(tagIds)].toSorted();
}

export interface OwnedTagsQuery {
  ownerId: string;
  tagIds: readonly string[];
}

/**
 * The owner's tags among those named, share-locked for the rest of the
 * transaction so a concurrent tag deletion waits for the write that uses it.
 */
export async function lockOwnedTagIds(
  tx: Database,
  { ownerId, tagIds }: Readonly<OwnedTagsQuery>,
): Promise<string[]> {
  const ids = tagIds.filter(isUuid);
  if (ids.length === 0) {
    return [];
  }
  const rows = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(and(inArray(tags.id, ids), eq(tags.userId, ownerId)))
    .orderBy(asc(tags.id))
    .for("share");
  return rows.map((row) => row.id);
}

/** The tags a transaction carries itself, sorted. */
export async function readTagIdsOf(
  db: Database,
  transactionId: string,
): Promise<string[]> {
  const rows = await db
    .select({ tagId: transactionTags.tagId })
    .from(transactionTags)
    .where(eq(transactionTags.transactionId, transactionId));
  return normalizeTagIds(rows.map((row) => row.tagId));
}

export interface ReplaceTagsInput {
  transactionId: string;
  tagIds: readonly string[];
}

/** Makes a transaction carry exactly these tags; tags it keeps keep their original time. */
export async function replaceTagsOf(
  tx: Database,
  { transactionId, tagIds }: Readonly<ReplaceTagsInput>,
): Promise<void> {
  await tx
    .delete(transactionTags)
    .where(
      and(
        eq(transactionTags.transactionId, transactionId),
        tagIds.length > 0
          ? notInArray(transactionTags.tagId, [...tagIds])
          : undefined,
      ),
    );
  if (tagIds.length > 0) {
    await tx
      .insert(transactionTags)
      .values(tagIds.map((tagId) => ({ transactionId, tagId })))
      .onConflictDoNothing();
  }
}

/** The tags carried by each of these transactions, by name; absent ids carry none. */
export async function readTagsByTransaction(
  db: Database,
  transactionIds: readonly string[],
): Promise<ReadonlyMap<string, readonly TransactionTag[]>> {
  const byTransaction = new Map<string, TransactionTag[]>();
  if (transactionIds.length === 0) {
    return byTransaction;
  }
  const rows = await db
    .select({
      transactionId: transactionTags.transactionId,
      id: tags.id,
      name: tags.name,
    })
    .from(transactionTags)
    .innerJoin(tags, eq(tags.id, transactionTags.tagId))
    .where(inArray(transactionTags.transactionId, [...new Set(transactionIds)]))
    .orderBy(asc(sql`lower(${tags.name})`), asc(tags.id));
  for (const row of rows) {
    const carried = byTransaction.get(row.transactionId) ?? [];
    carried.push({ id: row.id, name: row.name });
    byTransaction.set(row.transactionId, carried);
  }
  return byTransaction;
}

/** Holds when the transaction whose tags `carrier` names carries any of these tags. */
export function carriesAnyTag(carrier: SQL, tagIds: readonly string[]): SQL {
  const ids = tagIds.filter(isUuid);
  if (ids.length === 0) {
    return sql`false`;
  }
  return sql`exists (select 1 from ${transactionTags} where ${transactionTags.transactionId} = ${carrier} and ${inArray(transactionTags.tagId, ids)})`;
}
