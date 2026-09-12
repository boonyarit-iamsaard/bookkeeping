import { defineConfig } from "drizzle-kit";
import { env } from "@/core/configs/env";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/core/database/schema",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
