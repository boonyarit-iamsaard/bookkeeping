// Loads apps/web/.env before Next.js parses its CLI, so PORT in that file
// sets the local origin. `next dev` re-spawns with this flag in NODE_OPTIONS,
// where --env-file is not allowed, hence a preload module instead.
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (existsSync(".env")) {
  loadEnvFile(".env");
}
