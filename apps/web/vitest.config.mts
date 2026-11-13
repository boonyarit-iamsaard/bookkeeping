import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { coverage } from "../../vitest.coverage";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    coverage,
    name: "unit",
    environment: "node",
    include: ["src/**/*.unit.test.ts"],
    // The client config parses `import.meta.env` when imported; tests never
    // reach this origin, but every module below `core/api` depends on it.
    env: { VITE_API_ORIGIN: "http://localhost:5000" },
  },
});
