import { defineConfig } from "drizzle-kit";
import { env } from "@/core/env/config";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/core/database/schema",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
