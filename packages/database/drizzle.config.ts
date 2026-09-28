import { defineConfig } from "drizzle-kit";
import { parseDatabaseUrl } from "./src/database-url";

// drizzle-kit loads `.env` from this directory before reading the config, and
// never overrides a DATABASE_URL already present in the environment (as the
// test harness supplies it). Only commands that connect to a database need it;
// generation and consistency checks work without a local database.
const connectingCommands = new Set(["push", "migrate", "studio"]);
const command = process.argv[2];
const url =
  command !== undefined && connectingCommands.has(command)
    ? parseDatabaseUrl()
    : undefined;

export default defineConfig({
  schema: "./src/**/*.schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(url === undefined ? {} : { dbCredentials: { url } }),
});
