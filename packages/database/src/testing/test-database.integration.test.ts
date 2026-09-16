import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { users } from "../auth/auth.schema";
import { createTestUser, setupTestDatabase } from "./test-database";

const { withRollback, committed } = setupTestDatabase();

describe("test database fixtures", () => {
  test("a user created inside withRollback is gone once the test returns", async () => {
    let userId: string | undefined;

    await withRollback(async (db) => {
      const user = await createTestUser(db);
      userId = user.id;
      const [row] = await db.select().from(users).where(eq(users.id, user.id));
      expect(row?.email).toMatch(/@test\.local$/);
    });

    if (!userId) {
      throw new Error("withRollback did not run the test body");
    }
    const rows = await committed()
      .select()
      .from(users)
      .where(eq(users.id, userId));
    expect(rows).toHaveLength(0);
  });

  test("createTestUser gives every user a distinct email", async () => {
    await withRollback(async (db) => {
      const first = await createTestUser(db);
      const second = await createTestUser(db);
      expect(first.id).not.toBe(second.id);
    });
  });
});
