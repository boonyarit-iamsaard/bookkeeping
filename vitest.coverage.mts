import { fileURLToPath } from "node:url";

import type { CoverageOptions } from "vitest/node";

// Shared by every workspace's Vitest config; enabled only by `--coverage`.
export const coverage: CoverageOptions = {
  provider: "v8",
  include: ["src/**/*.{ts,tsx}"],
  exclude: ["src/**/*.test.ts", "src/testing/**", "src/**/*.gen.ts"],
  // Repository-relative lcov paths, so SonarQube Cloud can match each file.
  reporter: [
    "text-summary",
    "html",
    ["lcov", { projectRoot: fileURLToPath(new URL(".", import.meta.url)) }],
  ],
};
