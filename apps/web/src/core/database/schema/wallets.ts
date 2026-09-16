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
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/core/database/schema/auth";
import type { WalletSnapshot } from "@/features/wallets/wallet.types";
import { WALLET_TYPES } from "@/features/wallets/wallet.types";

export const walletTypeEnum = pgEnum("wallet_type", WALLET_TYPES);

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: walletTypeEnum("type").notNull(),
    // Explicit even though only THB is allowed, so amounts are never
    // ambiguous if a second currency ever arrives.
    currency: text("currency").notNull().default("THB"),
    // Integer satang. bigint keeps openings and aggregates exact well past
    // the signed 32-bit range.
    openingAmount: bigint("opening_amount", { mode: "bigint" }).notNull(),
    // The opening balance represents the start of this calendar date.
    openingDate: date("opening_date", { mode: "string" }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("wallets_user_id_idx").on(table.userId),
    check("wallets_currency_thb", sql`${table.currency} = 'THB'`),
  ],
);

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
}));

/** Retained internal history; never cascaded by wallet deletion. */
export const walletChanges = pgTable(
  "wallet_changes",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    before: jsonb("before").$type<WalletSnapshot>().notNull(),
    after: jsonb("after").$type<WalletSnapshot>().notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .default(sql`clock_timestamp()`)
      .notNull(),
  },
  (table) => [index("wallet_changes_wallet_id_idx").on(table.walletId)],
);
