import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/core/configs/env";
import {
  accounts,
  accountsRelations,
  sessions,
  sessionsRelations,
  users,
  usersRelations,
  verifications,
} from "@/core/database/schema/auth";

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
