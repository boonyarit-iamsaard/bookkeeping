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

async function lintFixture(files: ReadonlyMap<string, string>) {
  const fixture = await mkdtemp(join(tmpdir(), "bookkeeping-grit-"));
  try {
    await cp(join(repository, "biome.json"), join(fixture, "biome.json"));
    await cp(
      join(repository, "biome-plugins"),
      join(fixture, "biome-plugins"),
      { recursive: true },
    );
    for (const [path, source] of files) {
      await mkdir(dirname(join(fixture, path)), { recursive: true });
      await writeFile(join(fixture, path), source);
    }
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [biome, "lint", "--colors=off", "--max-diagnostics=none", "."],
      { cwd: fixture },
    ).then(
      (result) => result,
      (error: { stdout: string; stderr: string }) => error,
    );
    return stdout + stderr;
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}

it("reports the desktop check outside routes and the shell", async () => {
  const call =
    "export function Screen() {\n  return useIsDesktop() ? null : null;\n}\n";
  const report = await lintFixture(
    new Map([
      ["apps/web/src/features/home/components/home.tsx", call],
      ["apps/web/src/shared/components/card.tsx", call],
      ["apps/web/src/routes/_app/index.tsx", call],
      ["apps/web/src/core/shell/desktop-shell.tsx", call],
    ]),
  );

  expect(report, report).toContain("home.tsx:2:");
  expect(report, report).toContain("card.tsx:2:");
  expect(report).toContain("Only routes and core/shell call useIsDesktop");
  expect(report).not.toContain("index.tsx:");
  expect(report).not.toContain("desktop-shell.tsx:");
}, 30_000);

it("reports lg: classes outside the shell and allows sm: everywhere", async () => {
  const report = await lintFixture(
    new Map([
      [
        "apps/web/src/features/home/string.ts",
        'export const a = "flex lg:grid";\n',
      ],
      [
        "apps/web/src/features/home/jsx.tsx",
        'export const b = <div className="max-lg:hidden" />;\n',
      ],
      [
        "apps/web/src/features/home/template.ts",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: the fixture's source holds a template literal.
        "export const c = (x: string) => `p-4 ${x} lg:px-8`;\n",
      ],
      ["apps/web/src/routes/_app/route.ts", 'export const d = "lg:p-8";\n'],
      [
        "apps/web/src/features/home/small.ts",
        'export const e = "sm:p-4 blog:x";\n',
      ],
      [
        "apps/web/src/features/home/key.ts",
        'export const f = { lg: "h-11" };\n',
      ],
      ["apps/web/src/core/shell/shell.ts", 'export const g = "lg:flex";\n'],
    ]),
  );

  expect(report, report).toContain("string.ts:1:");
  expect(report, report).toContain("jsx.tsx:1:");
  expect(report, report).toContain("template.ts:1:");
  expect(report, report).toContain("route.ts:1:");
  expect(report).toContain("Only core/shell uses lg: classes");
  expect(report).not.toContain("small.ts:");
  expect(report).not.toContain("key.ts:");
  expect(report).not.toContain("shell.ts:");
}, 30_000);
