import { parseDatabaseUrl } from "./database-url";
import { migrateDatabase } from "./migrate";

async function main(): Promise<void> {
  await migrateDatabase(parseDatabaseUrl());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
