import { defineConfig } from "drizzle-kit";
import * as z from "zod";

// drizzle-kit loads `.env` from this directory before reading the config, and
// never overrides a DATABASE_URL already present in the environment (as the
// test harness supplies it). Only commands that connect to a database need it;
// generation and consistency checks work without a local database.
const connectingCommands = new Set(["push", "migrate", "studio"]);
const command = process.argv[2];
const url =
  command !== undefined && connectingCommands.has(command)
    ? z
        .url({
          error:
            "DATABASE_URL must be a PostgreSQL URL; set it in packages/database/.env",
        })
        .parse(process.env.DATABASE_URL)
    : undefined;

export default defineConfig({
  schema: "./src/**/*.schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(url === undefined ? {} : { dbCredentials: { url } }),
});
