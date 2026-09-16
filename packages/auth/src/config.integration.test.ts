import { initializeDefaultCategories } from "@bookkeeping/application/categories";
import { users } from "@bookkeeping/database/auth";
import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { and, eq, sql } from "drizzle-orm";
import { describe, expect, test, vi } from "vitest";
import { createAuth } from "./config";
import { resolveSession } from "./session";

const { withRollback } = setupTestDatabase();

const TEST_SECRET = "integration-test-secret-with-at-least-32-chars";
const TEST_BASE_URL = "http://localhost:4000";
const PASSWORD = "correct horse battery";

function uniqueEmail(label: string): string {
  return `${label}-${process.pid}-${Date.now()}@test.local`;
}

async function signUp(db: Database, email: string) {
  const auth = createAuth({ db, secret: TEST_SECRET, baseURL: TEST_BASE_URL });
  const { headers } = await auth.api.signUpEmail({
    body: { name: "Provisioned user", email, password: PASSWORD },
    returnHeaders: true,
  });
  const session = await resolveSession(
    auth,
    new Headers({ cookie: headers.get("set-cookie") ?? "" }),
  );
  if (!session) {
    throw new Error("Sign-up did not issue a session");
  }
  return session;
}

async function listProtected(db: Database, ownerId: string) {
  return db
    .select({ kind: categories.kind })
    .from(categories)
    .where(
      and(eq(categories.userId, ownerId), eq(categories.isProtected, true)),
    );
}

describe("createAuth", () => {
  test("a failed multi-write adapter flow leaves no partial rows behind", async () => {
    await withRollback(async (db) => {
      const auth = createAuth({
        db,
        secret: TEST_SECRET,
        baseURL: TEST_BASE_URL,
      });
      const { adapter } = await auth.$context;
      const email = uniqueEmail("rollback");

      await expect(
        adapter.transaction(async (trx) => {
          await trx.create({
            model: "user",
            data: { name: "Rolled back", email, emailVerified: false },
          });
          throw new Error("second write failed");
        }),
      ).rejects.toThrow("second write failed");

      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email));
      expect(rows).toEqual([]);
    });
  });

  test("sign-up provisions the complete default category set once the user commits", async () => {
    await withRollback(async (db) => {
      const session = await signUp(db, uniqueEmail("provisioned"));

      const protectedRows = await listProtected(db, session.user.id);

      expect(protectedRows.map((row) => row.kind).sort()).toEqual([
        "expense",
        "income",
      ]);
    });
  });

  test("a post-commit provisioning failure leaves a signed-in user without categories, which the retry completes", async () => {
    await withRollback(async (db) => {
      const reported = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      // DDL is transactional, so hiding the table inside the rolled-back
      // test transaction makes the real initializer fail after the auth
      // rows have committed, without a test-only seam in the hook.
      await db.execute(sql`alter table categories rename to categories_hidden`);

      const session = await signUp(db, uniqueEmail("interrupted"));

      await db.execute(sql`alter table categories_hidden rename to categories`);
      expect(reported).toHaveBeenCalledWith(
        "Fresh-user provisioning failed",
        expect.objectContaining({ userId: session.user.id }),
      );
      expect(await listProtected(db, session.user.id)).toEqual([]);

      const retried = await initializeDefaultCategories(db, session.user.id);

      expect(retried.seededKinds.slice().sort()).toEqual(["expense", "income"]);
      expect(
        (await listProtected(db, session.user.id))
          .map((row) => row.kind)
          .sort(),
      ).toEqual(["expense", "income"]);
      reported.mockRestore();
    });
  });
});
