import { migrateDatabase } from "@bookkeeping/database/migrate";
import * as z from "zod";
import { LOCK_TIMEOUT_MS } from "./migration-lock";

// Railway's pre-deploy command on the api service:
//   node dist/migrate.js
// It runs in the new image, with the api's own DATABASE_URL, before that image
// takes traffic. A failure stops the deploy and the old version keeps serving.
// The migrations ship in the image at /app/drizzle.

const databaseUrlSchema = z.url({
  error: "DATABASE_URL must be a PostgreSQL URL",
});

try {
  await migrateDatabase(databaseUrlSchema.parse(process.env.DATABASE_URL), {
    lockTimeoutMs: LOCK_TIMEOUT_MS,
  });
  console.log("Migrations are up to date.");
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
