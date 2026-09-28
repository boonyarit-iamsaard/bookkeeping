import * as z from "zod";

const databaseUrlSchema = z.url({
  error:
    "DATABASE_URL must be a PostgreSQL URL; set it in packages/database/.env",
});

export function parseDatabaseUrl(): string {
  return databaseUrlSchema.parse(process.env.DATABASE_URL);
}
