import { setupTestDatabase } from "@bookkeeping/database/testing";
import { describe, expect, test } from "vitest";
import { resolveSession } from "./session";
import { createTestAuth, uniqueTestEmail } from "./testing/test-auth";

const { withRollback } = setupTestDatabase();

describe("resolveSession", () => {
  test("a signed-up user's cookie resolves to their session", async () => {
    await withRollback(async (db) => {
      const auth = createTestAuth(db);
      const email = uniqueTestEmail("session");
      const { headers } = await auth.api.signUpEmail({
        body: {
          name: "Session user",
          email,
          password: "correct horse battery",
        },
        returnHeaders: true,
      });
      const cookie = headers.get("set-cookie");
      expect(cookie).toContain("better-auth.session_token=");

      const session = await resolveSession(
        auth,
        new Headers({ cookie: cookie ?? "" }),
      );

      expect(session).toEqual({
        id: expect.any(String),
        expiresAt: expect.any(Date),
        user: { id: expect.any(String), email, name: "Session user" },
      });
    });
  });

  test("a request without a session cookie resolves to no session", async () => {
    await withRollback(async (db) => {
      const auth = createTestAuth(db);

      expect(await resolveSession(auth, new Headers())).toBeNull();
    });
  });

  test("a forged session cookie resolves to no session", async () => {
    await withRollback(async (db) => {
      const auth = createTestAuth(db);

      const session = await resolveSession(
        auth,
        new Headers({ cookie: "better-auth.session_token=not-a-real-token" }),
      );

      expect(session).toBeNull();
    });
  });
});
