import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    environment: "node",
    include: ["src/**/*.unit.test.ts"],
  },
});
