import { requiredDatabaseUrl } from "./database-url";
import { freshDatabase } from "./migrate";

async function main(): Promise<void> {
  await freshDatabase(requiredDatabaseUrl());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
