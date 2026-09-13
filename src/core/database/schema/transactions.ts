import { relations, sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/core/database/schema/auth";
import { categories } from "@/core/database/schema/categories";
import { TRANSACTION_TYPES } from "@/core/database/schema/transaction-type";
import { wallets } from "@/core/database/schema/wallets";

export const transactionTypeEnum = pgEnum(
  "transaction_type",
  TRANSACTION_TYPES,
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: transactionTypeEnum("type").notNull(),
    // Restrict, never cascade: a wallet with history cannot be deleted.
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    currency: text("currency").notNull().default("THB"),
    // Integer satang, always positive; the type carries the sign.
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    // The calendar date the money moved; the only date with financial effect.
    transactionDate: date("transaction_date", { mode: "string" }).notNull(),
    note: text("note").notNull().default(""),
    // The server instant the transaction was first entered. Never edited.
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Soft deletion keeps the row for internal history; balances ignore it.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("transactions_user_id_date_idx").on(
      table.userId,
      table.transactionDate,
    ),
    index("transactions_wallet_id_idx").on(table.walletId),
    index("transactions_category_id_idx").on(table.categoryId),
    check("transactions_currency_thb", sql`${table.currency} = 'THB'`),
    check(
      "transactions_amount_range",
      sql`${table.amount} between 1 and 9999999999`,
    ),
    check("transactions_note_length", sql`char_length(${table.note}) <= 200`),
  ],
);

/**
 * One receipt per logical create submission, scoped to owner and operation.
 * Committed in the same transaction as the record it points to, so a retry
 * either finds the receipt and its record or neither.
 */
export const submissionReceipts = pgTable(
  "submission_receipts",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    operation: text("operation").notNull(),
    key: text("key").notNull(),
    // SHA-256 of the canonical validated payload; a retry with a different
    // payload under the same key is a conflict, never an overwrite.
    payloadFingerprint: text("payload_fingerprint").notNull(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // The unique index is what makes concurrent duplicates wait, then lose.
    uniqueIndex("submission_receipts_owner_operation_key").on(
      table.userId,
      table.operation,
      table.key,
    ),
  ],
);

export const TRANSACTION_CHANGE_ACTIONS = ["edit", "delete"] as const;
export type TransactionChangeAction =
  (typeof TRANSACTION_CHANGE_ACTIONS)[number];

export const transactionChangeActionEnum = pgEnum(
  "transaction_change_action",
  TRANSACTION_CHANGE_ACTIONS,
);

/**
 * The fields of a transaction that carry financial or descriptive meaning,
 * frozen as they stood before and after a change. Amounts are decimal
 * strings because JSON has no bigint. Transfer and refund corrections can
 * extend this shape without a new table.
 */
export interface TransactionSnapshot {
  type: (typeof TRANSACTION_TYPES)[number];
  walletId: string;
  categoryId: string;
  amount: string;
  transactionDate: string;
  note: string;
}

/**
 * Internal change history: one row per successful edit or deletion, written
 * in the same database transaction as the change itself. Never shown in
 * normal views and never part of any balance.
 */
export const transactionChanges = pgTable(
  "transaction_changes",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    action: transactionChangeActionEnum("action").notNull(),
    before: jsonb("before").$type<TransactionSnapshot>().notNull(),
    // Null once the transaction is deleted.
    after: jsonb("after").$type<TransactionSnapshot>(),
    // The instant of the write itself, not the transaction's start: edits
    // that waited on the row lock must sort after the one they waited for.
    changedAt: timestamp("changed_at", { withTimezone: true })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => [
    index("transaction_changes_transaction_id_idx").on(
      table.transactionId,
      table.changedAt,
    ),
  ],
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  wallet: one(wallets, {
    fields: [transactions.walletId],
    references: [wallets.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));
