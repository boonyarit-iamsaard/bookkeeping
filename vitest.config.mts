import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    environment: "node",
    include: ["scripts/**/*.unit.test.ts"],
  },
});
