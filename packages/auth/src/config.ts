import { initializeDefaultCategories } from "@bookkeeping/application/categories";
import {
  accounts,
  accountsRelations,
  sessions,
  sessionsRelations,
  users,
  usersRelations,
  verifications,
} from "@bookkeeping/database/auth";
import type { Database } from "@bookkeeping/database/connection";
import type { BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export interface AuthOptions {
  db: Database;
  /** At least 32 characters; validated by the app that reads its environment. */
  secret: string;
  /** The origin this mount answers on, so each app keeps its own host-only cookie. */
  baseURL: string;
  /**
   * Framework plugins the mounting app needs, such as `nextCookies()`.
   * They are appended last so they observe every core endpoint.
   */
  plugins?: readonly BetterAuthPlugin[];
  /**
   * Browser origins other than `baseURL` that may send credentialed requests,
   * such as the SPA origin the Hono mount serves. The Next.js mount is
   * same-origin and leaves this empty.
   */
  trustedOrigins?: readonly string[];
  /**
   * Names this mount's cookies (`<prefix>.session_token`). Host-only cookies
   * ignore the port, so mounts sharing a hostname in local development need
   * distinct prefixes or they overwrite each other. Defaults to Better
   * Auth's `better-auth`, which the Next.js mount keeps.
   */
  cookiePrefix?: string;
}

/**
 * Builds one Better Auth instance over the shared user store. Next.js and
 * Hono mount the same configuration against the same database and secret;
 * only the framework mount and browser client differ per app.
 */
export function createAuth({
  db,
  secret,
  baseURL,
  plugins,
  trustedOrigins,
  cookiePrefix,
}: AuthOptions) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        accounts,
        accountsRelations,
        sessions,
        sessionsRelations,
        users,
        usersRelations,
        verifications,
      },
      usePlural: true,
      // Better Auth's own multi-write flows (sign-up creates a user and an
      // account) commit or roll back together.
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
    },
    secret,
    baseURL,
    trustedOrigins: [...(trustedOrigins ?? [])],
    advanced: {
      // Better Auth skips origin and CSRF checks under NODE_ENV=test unless
      // told otherwise; the checks are part of the contract, so tests run
      // them too. Cookies stay host-only and HTTP-only by default, and
      // crossSubDomainCookies stays disabled: each mount owns its cookie.
      disableOriginCheck: false,
      disableCSRFCheck: false,
      ...(cookiePrefix === undefined ? {} : { cookiePrefix }),
      database: {
        // The database owns id generation: every `id` column defaults to
        // `uuidv7()`. Do not use "uuid" here — that mode makes Better Auth
        // generate a v4 id itself, and its validation rejects v7 ids.
        generateId: false,
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: (user) => provisionCreatedUser(db, user.id),
        },
      },
    },
    plugins: [...(plugins ?? [])],
  });
}

/**
 * Better Auth runs this after the sign-up transaction commits, so a failure
 * here can no longer roll the user back. Sign-up still succeeds — the user
 * exists and holds a session — and the explicit provisioning retry completes
 * the default set; throwing would instead fail a request whose user was
 * already created.
 */
async function provisionCreatedUser(db: Database, userId: string) {
  try {
    await initializeDefaultCategories(db, userId);
  } catch (error) {
    console.error("Fresh-user provisioning failed", { userId, error });
  }
}

export type Auth = ReturnType<typeof createAuth>;
