import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    name: "integration",
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    hookTimeout: 60_000,
    globalSetup: ["@bookkeeping/database/testing/global-setup"],
    fileParallelism: false,
  },
});
