import { parseDatabaseUrl } from "./database-url";
import { freshDatabase } from "./migrate";

async function main(): Promise<void> {
  await freshDatabase(parseDatabaseUrl());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
