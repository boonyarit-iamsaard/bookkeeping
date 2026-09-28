import { build } from "esbuild";

// Workspace packages ship TypeScript source, so the server bundles them into
// its Node.js entrypoints: the server and the owner-run password reset. Every
// other module stays external and resolves from node_modules at runtime, so
// the server declares those runtime dependencies itself, including the ones
// the bundled packages import.
const WORKSPACE_SCOPE = "@bookkeeping/";

await build({
  entryPoints: ["src/server.ts", "src/reset-password-cli.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  sourcemap: true,
  logLevel: "info",
  plugins: [
    {
      name: "external-node-modules",
      setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /^[^./]/ }, (args) =>
          args.path.startsWith(WORKSPACE_SCOPE)
            ? undefined
            : { path: args.path, external: true },
        );
      },
    },
  ],
});
