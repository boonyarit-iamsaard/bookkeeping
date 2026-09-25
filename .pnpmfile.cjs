// better-auth declares vitest (for better-auth/test) and drizzle-kit (for its
// schema CLI) as optional peers. pnpm links any optional peer the workspace
// already installs, so the production API image would carry the vite, vitest,
// and drizzle-kit toolchains. The app uses neither entry point.
const UNUSED_BETTER_AUTH_PEERS = ["vitest", "drizzle-kit"];

function readPackage(manifest) {
  if (manifest.name === "better-auth") {
    for (const peer of UNUSED_BETTER_AUTH_PEERS) {
      delete manifest.peerDependencies?.[peer];
      delete manifest.peerDependenciesMeta?.[peer];
    }
  }
  return manifest;
}

module.exports = { hooks: { readPackage } };
