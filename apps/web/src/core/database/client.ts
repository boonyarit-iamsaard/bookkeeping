import "server-only";

import { createDatabase } from "@/core/database/database";
import { env } from "@/core/env/config";

export const { db } = createDatabase(env.DATABASE_URL);
