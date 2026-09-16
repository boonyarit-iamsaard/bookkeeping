import { defineConfig } from "drizzle-kit";
import * as z from "zod";

// drizzle-kit loads `.env` from this directory before reading the config, and
// never overrides a DATABASE_URL already present in the environment (as the
// test harness supplies it). The value is validated here rather than read
// through any app's environment module. No `out` directory is configured:
// the schema is applied with `db:push` only and no migrations are generated.
const url = z
  .url({
    error:
      "DATABASE_URL must be a PostgreSQL URL; set it in packages/database/.env",
  })
  .parse(process.env.DATABASE_URL);

export default defineConfig({
  schema: "./src/**/*.schema.ts",
  dialect: "postgresql",
  dbCredentials: { url },
});
