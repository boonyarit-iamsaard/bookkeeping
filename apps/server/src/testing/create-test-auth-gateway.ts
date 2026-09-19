import type { Session } from "@bookkeeping/auth/session";
import { users } from "@bookkeeping/database/auth";
import type { Database } from "@bookkeeping/database/connection";
import { createTestUser } from "@bookkeeping/database/testing";
import { eq } from "drizzle-orm";
import * as z from "zod";
import type { AuthGateway } from "../core/auth/gateway.js";

const TEST_USER_COOKIE = "bookkeeping-test.user";

const testUserIdSchema = z.uuid();

function readTestUserCookie(headers: Headers): string | null {
  const cookie = headers.get("cookie");
  if (!cookie) {
    return null;
  }
  for (const pair of cookie.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const name = pair.slice(0, separator).trim();
    if (name === TEST_USER_COOKIE) {
      return pair.slice(separator + 1).trim() || null;
    }
  }
  return null;
}

/**
 * The auth gateway route integration tests substitute: it resolves the
 * `bookkeeping-test.user` cookie to a session for a real user row, so tests
 * provision owners without paying for a Better Auth sign-up.
 */
export function createTestAuthGateway(db: Database): AuthGateway {
  return {
    async handleRequest() {
      return new Response(null, { status: 404 });
    },
    async resolveSession(headers) {
      const userId = readTestUserCookie(headers);
      const parsed = testUserIdSchema.safeParse(userId);
      if (!parsed.success) {
        return null;
      }
      const [user] = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, parsed.data))
        .limit(1);
      if (!user) {
        return null;
      }
      return {
        id: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        user: { id: user.id, email: user.email, name: user.name },
      } satisfies Session;
    },
  };
}

/**
 * Provisions an owner for route tests: a real user row plus the cookie that
 * `createTestAuthGateway` resolves to a session for it.
 */
export async function createOwnerSession(db: Database): Promise<{
  ownerId: string;
  cookie: string;
}> {
  const user = await createTestUser(db);
  return { ownerId: user.id, cookie: `${TEST_USER_COOKIE}=${user.id}` };
}
