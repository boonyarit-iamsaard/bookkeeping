import { users } from "@bookkeeping/database/auth";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { afterAll, describe, expect, test, vi } from "vitest";
import { auth } from "@/core/auth/config";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";

// The Next.js mount reads request headers from the framework and the database
// from the web app's client; both are replaced so the real Better Auth
// configuration runs over the test database.
const harness = vi.hoisted(() => ({ close: async () => {} }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/core/database/client", async () => {
  const { createDatabase } = await import("@bookkeeping/database/connection");
  const { inject } = await import("vitest");
  const connection = createDatabase(inject("testDatabaseUrl"));
  harness.close = connection.close;
  return { db: connection.db };
});

// getSession() reads the module-level client, so these runs commit; the
// signed-up user is removed afterwards instead of rolled back.
const email = `web-session-${process.pid}-${Date.now()}@test.local`;

afterAll(async () => {
  await db.delete(users).where(eq(users.email, email));
  await harness.close();
});

describe("getSession", () => {
  test("a request carrying a signed-up user's cookie resolves to their session", async () => {
    const signUp = await auth.api.signUpEmail({
      body: { name: "Web user", email, password: "correct horse battery" },
      returnHeaders: true,
    });
    vi.mocked(headers).mockResolvedValue(
      new Headers({ cookie: signUp.headers.get("set-cookie") ?? "" }),
    );

    const session = await getSession();

    expect(session?.user).toEqual({
      id: expect.any(String),
      email,
      name: "Web user",
    });
  });

  test("a request without a session cookie resolves to no session", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers());

    expect(await getSession()).toBeNull();
  });
});
