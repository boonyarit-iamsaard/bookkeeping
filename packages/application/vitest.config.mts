import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.unit.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.integration.test.ts"],
          hookTimeout: 60_000,
          globalSetup: ["@bookkeeping/database/testing/global-setup"],
          fileParallelism: false,
        },
      },
    ],
  },
});
