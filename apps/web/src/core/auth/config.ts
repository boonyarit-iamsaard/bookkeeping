import {
  accounts,
  accountsRelations,
  sessions,
  sessionsRelations,
  users,
  usersRelations,
  verifications,
} from "@bookkeeping/database/auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/core/database/client";
import { env } from "@/core/env/config";

export const auth = betterAuth({
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
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  advanced: {
    database: {
      // The database owns id generation: every `id` column defaults to
      // `uuidv7()`. Do not use "uuid" here — that mode makes Better Auth
      // generate a v4 id itself, and its validation rejects v7 ids.
      generateId: false,
    },
  },
  // Must stay last: lets server actions set the session cookie.
  plugins: [nextCookies()],
});
