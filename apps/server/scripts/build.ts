import { build } from "esbuild";

// Workspace packages ship TypeScript source, so the server bundles them into
// one Node.js entrypoint. Every other module stays external and resolves from
// node_modules at runtime, so the server declares those runtime dependencies
// itself, including the ones the bundled packages import.
const WORKSPACE_SCOPE = "@bookkeeping/";

await build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.js",
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
