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
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export interface AuthOptions {
  db: Database;
  /** At least 32 characters; validated by the app that reads its environment. */
  secret: string;
  /** The origin this mount answers on, so its session cookie is host-only. */
  baseURL: string;
  /**
   * Browser origins other than `baseURL` that may send credentialed requests,
   * such as the SPA origin served by the Hono mount.
   */
  trustedOrigins?: readonly string[];
  /**
   * Names this mount's cookies (`<prefix>.session_token`). Host-only cookies
   * ignore the port, so mounts sharing a hostname in local development need
   * distinct prefixes or they overwrite each other. Defaults to Better
   * Auth's `better-auth`.
   */
  cookiePrefix?: string;
  /**
   * Whether Better Auth throttles its own endpoints. Omitted, it follows
   * Better Auth's default: on only under NODE_ENV=production.
   */
  rateLimitEnabled?: boolean;
  /** False refuses new email/password sign-ups. Defaults to true. */
  signUpEnabled?: boolean;
}

/**
 * Builds the Hono Better Auth instance over the shared user store.
 */
export function createAuth({
  db,
  secret,
  baseURL,
  trustedOrigins,
  cookiePrefix,
  rateLimitEnabled,
  signUpEnabled,
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
      disableSignUp: signUpEnabled === false,
    },
    secret,
    baseURL,
    trustedOrigins: [...(trustedOrigins ?? [])],
    ...(rateLimitEnabled === undefined
      ? {}
      : { rateLimit: { enabled: rateLimitEnabled } }),
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
