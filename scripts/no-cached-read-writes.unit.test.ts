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

const forbidden = [
  "invalidateQueries",
  "removeQueries",
  "resetQueries",
  "setQueryData",
  "setQueriesData",
];
const allowed = [
  "apps/web/src/core/query/refresh-after-write.ts",
  "apps/web/src/core/query/refresh-after-write.unit.test.ts",
  "apps/web/src/core/query/seed.unit.test.tsx",
];

it("reports cached-read writes in the web app except refresh-after-write and tests", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "bookkeeping-grit-"));
  try {
    await cp(join(repository, "biome.json"), join(fixture, "biome.json"));
    await cp(
      join(repository, "biome-plugins"),
      join(fixture, "biome-plugins"),
      { recursive: true },
    );
    const files = new Map<string, string>([
      ...forbidden.map(
        (method) =>
          [
            `apps/web/src/features/wallets/${method}.ts`,
            `queryClient.${method}();\n`,
          ] as const,
      ),
      [
        "apps/web/src/features/wallets/optional.ts",
        "queryClient?.invalidateQueries();\n",
      ] as const,
      [
        "apps/web/src/features/wallets/bracket.ts",
        'queryClient["removeQueries"]();\n',
      ] as const,
      [
        "apps/web/src/features/wallets/refetch.ts",
        "queryClient.refetchQueries();\n",
      ] as const,
      [
        "apps/web/src/features/wallets/clear.ts",
        "queryClient.clear();\n",
      ] as const,
      [
        "apps/web/src/features/wallets/seen.ts",
        "new Map().clear();\n",
      ] as const,
      ["apps/web/src/core/auth/session.ts", "queryClient.clear();\n"] as const,
      ...allowed.map(
        (path) => [path, "queryClient.invalidateQueries();\n"] as const,
      ),
    ]);
    for (const [path, source] of files) {
      await mkdir(dirname(join(fixture, path)), { recursive: true });
      await writeFile(join(fixture, path), source);
    }

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [biome, "lint", "--colors=off", "."],
      { cwd: fixture },
    ).then(
      (result) => result,
      (error: { stdout: string; stderr: string }) => error,
    );
    const report = stdout + stderr;

    for (const method of forbidden) {
      expect(report, report).toContain(`${method}.ts:1:`);
    }
    expect(report, report).toContain("optional.ts:1:");
    expect(report, report).toContain("bracket.ts:1:");
    expect(report, report).toContain("clear.ts:1:");
    expect(report).not.toContain("refetch.ts:");
    expect(report).not.toContain("seen.ts:");
    expect(report).toContain("refreshAfterWrite");
    expect(report).toContain("forgetReads");
    expect(report).not.toMatch(/^apps.web.src.core/m);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}, 30_000);
