import { MAX_TAG_NAME_LENGTH } from "@bookkeeping/domain/tags";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../auth/auth.schema";
import { transactions } from "../transactions/transaction.schema";

/** One row per tag an Account owns; names are unique per owner ignoring case. */
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("tags_user_name_unique").on(
      table.userId,
      sql`lower(${table.name})`,
    ),
    check(
      "tags_name_length",
      sql`char_length(${table.name}) between 1 and ${sql.raw(String(MAX_TAG_NAME_LENGTH))}`,
    ),
  ],
);

/**
 * The tags an income or expense carries. A refund has no rows of its own: it
 * reads its expense's. Deleting a tag removes its rows and keeps the
 * transactions.
 */
export const transactionTags = pgTable(
  "transaction_tags",
  {
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    // When the tag was put on the transaction; suggestions rank by it. The
    // write's own instant, so tags put on in one transaction still order.
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.transactionId, table.tagId] }),
    index("transaction_tags_tag_id_idx").on(table.tagId),
  ],
);
