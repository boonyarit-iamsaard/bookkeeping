import type { CoverageOptions } from "vitest/node";

// Shared by every workspace's Vitest config; enabled only by `--coverage`.
export const coverage: CoverageOptions = {
  provider: "v8",
  include: ["src/**/*.{ts,tsx}"],
  exclude: ["src/**/*.test.ts", "src/testing/**", "src/**/*.gen.ts"],
  reporter: ["text-summary", "html", "lcov"],
};
