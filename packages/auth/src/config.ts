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
}

/**
 * Builds one Better Auth instance over the shared user store. Next.js and
 * Hono mount the same configuration against the same database and secret;
 * only the framework mount and browser client differ per app.
 */
export function createAuth({ db, secret, baseURL, plugins }: AuthOptions) {
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
    advanced: {
      database: {
        // The database owns id generation: every `id` column defaults to
        // `uuidv7()`. Do not use "uuid" here — that mode makes Better Auth
        // generate a v4 id itself, and its validation rejects v7 ids.
        generateId: false,
      },
    },
    plugins: [...(plugins ?? [])],
  });
}

export type Auth = ReturnType<typeof createAuth>;
