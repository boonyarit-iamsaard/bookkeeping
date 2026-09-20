import "server-only";

import { createDatabase } from "@bookkeeping/database/connection";
import { env } from "@/core/env/config";

export const { db } = createDatabase(env.DATABASE_URL);
