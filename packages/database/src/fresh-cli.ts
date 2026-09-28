import { parseDatabaseUrl } from "./database-url";
import { freshDatabase } from "./migrate";

try {
  await freshDatabase(parseDatabaseUrl());
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
