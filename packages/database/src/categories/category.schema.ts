import { CATEGORY_KINDS } from "@bookkeeping/domain/categories";
import { relations, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../auth/auth.schema";

export const categoryKindEnum = pgEnum("category_kind", CATEGORY_KINDS);

/**
 * One row per category in a user's income or expense tree. Parents have no
 * parentId; children reference a parent of the same owner and kind.
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: categoryKindEnum("kind").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "restrict",
    }),
    name: text("name").notNull(),
    // A stable catalog identifier, never a glyph name; unknown ids render the
    // generic icon.
    iconId: text("icon_id").notNull(),
    // Uncategorized: exactly one per tree, cannot be removed or renamed.
    isProtected: boolean("is_protected").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("categories_user_id_kind_idx").on(table.userId, table.kind),
    uniqueIndex("categories_one_protected_per_tree")
      .on(table.userId, table.kind)
      .where(sql`${table.isProtected}`),
    uniqueIndex("categories_parent_name_unique")
      .on(table.userId, table.kind, sql`lower(${table.name})`)
      .where(sql`${table.parentId} is null`),
    uniqueIndex("categories_child_name_unique")
      .on(table.parentId, sql`lower(${table.name})`)
      .where(sql`${table.parentId} is not null`),
  ],
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "children",
  }),
  children: many(categories, { relationName: "children" }),
}));
