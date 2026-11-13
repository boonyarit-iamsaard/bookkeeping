import { defineConfig } from "vitest/config";
import { coverage } from "../../vitest.coverage";

export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    coverage,
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
          globalSetup: ["src/testing/global-setup.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
