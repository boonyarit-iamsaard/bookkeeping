import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repository = fileURLToPath(new URL("../", import.meta.url));
const biome = join(repository, "node_modules/@biomejs/biome/bin/biome");

const forms = {
  named: (source: string) => `import { a } from "${source}";\nexport { a };\n`,
  type: (source: string) =>
    `import type { A } from "${source}";\nexport type { A };\n`,
  sideEffect: (source: string) => `import "${source}";\n`,
  dynamic: (source: string) => `export const a = import("${source}");\n`,
  reexport: (source: string) => `export { a } from "${source}";\n`,
  typeReexport: (source: string) => `export type { A } from "${source}";\n`,
  star: (source: string) => `export * from "${source}";\n`,
  namespace: (source: string) => `export * as a from "${source}";\n`,
};

const featureImports = Object.entries(forms).map(
  ([form, write]) =>
    [
      `apps/web/src/core/api/${form}.ts`,
      write("@/features/wallets/x"),
    ] as const,
);
const parentImports = Object.entries(forms).map(
  ([form, write]) =>
    [
      `apps/web/src/features/wallets/components/${form}.ts`,
      write("../x"),
    ] as const,
);
const allowed = [
  ["apps/web/src/core/api/sibling.ts", forms.named("./x")],
  [
    "apps/web/src/features/tags/feature.ts",
    forms.named("@/features/wallets/x"),
  ],
  ["apps/server/src/core/parent.ts", forms.named("../x")],
] as const;

function pluginDiagnostic(path: string) {
  return new RegExp(`${path.replaceAll(/[./]/g, "[./\\\\]")}:\\d+:\\d+ plugin`);
}

it("reports feature imports from shared and core, and parent imports anywhere in the web app", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "bookkeeping-grit-"));
  try {
    await cp(join(repository, "biome.json"), join(fixture, "biome.json"));
    await cp(
      join(repository, "biome-plugins"),
      join(fixture, "biome-plugins"),
      { recursive: true },
    );
    for (const [path, source] of [
      ...featureImports,
      ...parentImports,
      ...allowed,
    ]) {
      await mkdir(dirname(join(fixture, path)), { recursive: true });
      await writeFile(join(fixture, path), source);
    }

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [biome, "lint", "--colors=off", "--max-diagnostics=200", "."],
      { cwd: fixture },
    ).then(
      (result) => result,
      (error: { stdout: string; stderr: string }) => error,
    );
    const report = stdout + stderr;

    for (const [path] of [...featureImports, ...parentImports]) {
      expect(report, report).toMatch(pluginDiagnostic(path));
    }
    for (const [path] of allowed) {
      expect(report, report).not.toMatch(pluginDiagnostic(path));
    }
    expect(report).toContain("shared and core never import features");
    expect(report).toContain("Use ./ for a module in the same directory");
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}, 30_000);
