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
          // Matches hookTimeout: a loaded machine can slow migrations past
          // the 5 s default, as a reset under full CI load did.
          testTimeout: 60_000,
          hookTimeout: 60_000,
          globalSetup: ["src/testing/global-setup.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
