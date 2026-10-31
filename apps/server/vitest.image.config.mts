import { defineConfig } from "vitest/config";

// Builds the api image, so it stays out of `pnpm test`; run `pnpm test:image`.
export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    name: "image",
    environment: "node",
    include: ["src/**/*.image.test.ts"],
    hookTimeout: 60_000,
    globalSetup: ["@bookkeeping/database/testing/global-setup"],
    fileParallelism: false,
  },
});
