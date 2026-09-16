import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "integration",
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    hookTimeout: 60_000,
    globalSetup: ["src/testing/global-setup.ts"],
    fileParallelism: false,
  },
});
