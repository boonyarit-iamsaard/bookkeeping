// Shared by every workspace's Stryker config; see docs/development/testing.md.
// Reports and the incremental file use Stryker's default `reports/` paths.
export const strykerBase = {
  testRunner: "vitest",
  // pnpm keeps plugins out of core's reach, so name them instead of auto-discovering.
  plugins: ["@stryker-mutator/vitest-runner"],
  mutate: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/testing/**",
    "!src/**/*.gen.ts",
  ],
  reporters: ["clear-text", "html", "json"],
  incremental: true,
  // Sandboxes sit two levels under the root, like workspaces, so `../../` paths
  // resolve unchanged; naming no tsconfig stops Stryker rewriting its `extends`.
  tempDirName: "../../.stryker-tmp",
  tsconfigFile: "",
  // Stryker runs exclusively on this machine; each worker is a Vitest process.
  concurrency: 2,
};
