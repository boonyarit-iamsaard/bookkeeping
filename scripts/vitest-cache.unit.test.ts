import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repository = fileURLToPath(new URL("../", import.meta.url));
const vitestPackage = realpathSync(join(repository, "node_modules/vitest"));
const workspaces = [
  ".",
  "apps/server",
  "apps/web",
  "packages/application",
  "packages/auth",
  "packages/database",
  "packages/domain",
];

it("clearing one Vitest invocation preserves the other invocations' module caches", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "bookkeeping-vitest-cache-"));
  try {
    await writeFile(
      join(fixture, "package.json"),
      JSON.stringify({ private: true, workspaces: ["apps/*", "packages/*"] }),
    );
    await mkdir(join(fixture, "node_modules"));
    await symlink(
      vitestPackage,
      join(fixture, "node_modules/vitest"),
      "junction",
    );
    for (const workspace of workspaces) {
      const directory = join(fixture, workspace);
      await mkdir(directory, { recursive: true });
      await copyFile(
        join(repository, workspace, "vitest.config.mts"),
        join(directory, "vitest.config.mts"),
      );
    }

    for (const workspace of workspaces) {
      for (const owner of workspaces) {
        const cache = join(fixture, owner, "node_modules/.vitest-cache");
        await mkdir(cache, { recursive: true });
        await writeFile(join(cache, "cached-module"), owner);
      }

      await execFileAsync(
        process.execPath,
        [join(vitestPackage, "vitest.mjs"), "--clearCache"],
        { cwd: join(fixture, workspace), timeout: 15_000 },
      );

      for (const owner of workspaces) {
        const cachedModule = join(
          fixture,
          owner,
          "node_modules/.vitest-cache/cached-module",
        );
        if (owner === workspace) {
          await expect(access(cachedModule)).rejects.toThrow();
        } else {
          expect(await readFile(cachedModule, "utf-8")).toBe(owner);
        }
      }
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}, 60_000);
