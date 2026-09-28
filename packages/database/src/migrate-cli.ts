import { parseDatabaseUrl } from "./database-url";
import { migrateDatabase } from "./migrate";

try {
  await migrateDatabase(parseDatabaseUrl());
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
