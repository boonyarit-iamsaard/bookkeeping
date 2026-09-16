import { sql } from "drizzle-orm";
import {
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../auth/auth.schema";

/**
 * One durable result per logical resource creation. The result is an
 * application-owned snapshot, not an HTTP response, and therefore survives
 * later changes to or removal of the created resource.
 */
export const creationReceipts = pgTable(
  "creation_receipts",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    operation: text("operation").notNull(),
    key: text("key").notNull(),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    result: jsonb("result").$type<unknown>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("creation_receipts_owner_operation_key").on(
      table.userId,
      table.operation,
      table.key,
    ),
    check(
      "creation_receipts_fingerprint_sha256",
      sql`char_length(${table.payloadFingerprint}) = 64`,
    ),
  ],
);
