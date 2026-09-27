import * as z from "zod";
import { migrateDatabase } from "./migrate";

const databaseUrlSchema = z.url({
  error:
    "DATABASE_URL must be a PostgreSQL URL; set it in packages/database/.env",
});

function requiredDatabaseUrl(): string {
  return databaseUrlSchema.parse(process.env.DATABASE_URL);
}

async function main(): Promise<void> {
  await migrateDatabase(requiredDatabaseUrl());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
