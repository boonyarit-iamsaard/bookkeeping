import { defineConfig } from "vitest/config";
import { coverage } from "../../vitest.coverage";

export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    coverage,
    environment: "node",
    include: ["src/**/*.unit.test.ts"],
  },
});
