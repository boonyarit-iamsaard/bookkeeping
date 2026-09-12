import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  accounts,
  accountsRelations,
  sessions,
  sessionsRelations,
  users,
  usersRelations,
  verifications,
} from "@/core/database/schema/auth";
import { env } from "@/core/env/config";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const db = drizzle({
  client: pool,
  schema: {
    accounts,
    accountsRelations,
    sessions,
    sessionsRelations,
    users,
    usersRelations,
    verifications,
  },
});
