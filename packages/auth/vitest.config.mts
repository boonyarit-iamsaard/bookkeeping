import { defineConfig } from "vitest/config";
import { coverage } from "../../vitest.coverage.mts";

export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    coverage,
    name: "integration",
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    hookTimeout: 60_000,
    // scrypt hashing is CPU-bound and passed 5 s on a CI runner under turbo parallel load.
    testTimeout: 30_000,
    globalSetup: ["@bookkeeping/database/testing/global-setup"],
    fileParallelism: false,
  },
});
