import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const requireFromRunner = createRequire(import.meta.url);
const clientDirectory = fileURLToPath(new URL("../../", import.meta.url));
const viteBin = join(clientDirectory, "node_modules/vite/bin/vite.js");

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a browser test port"));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

interface BuildOptions {
  apiOrigin: string;
  distDirectory: string;
}

/**
 * The API origin is baked into the bundle at build time, and the port is only
 * known now, so the CI run builds its own copy for `vite preview` instead of
 * serving the Turborepo build.
 */
async function buildClient({
  apiOrigin,
  distDirectory,
}: Readonly<BuildOptions>): Promise<void> {
  const child = spawn(
    process.execPath,
    [viteBin, "build", "--outDir", distDirectory, "--logLevel", "warn"],
    {
      cwd: clientDirectory,
      env: { ...process.env, VITE_API_ORIGIN: apiOrigin },
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  const [code] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(`The client build exited with ${code}`);
  }
}

interface PlaywrightOptions {
  clientPort: number;
  apiPort: number;
  distDirectory: string | undefined;
}

/** The arguments after the script, without the `--` pnpm forwards before them. */
function playwrightArguments(): string[] {
  const [first, ...rest] = process.argv.slice(2);
  if (first === undefined) {
    return [];
  }
  return first === "--" ? rest : [first, ...rest];
}

function runPlaywright({
  clientPort,
  apiPort,
  distDirectory,
}: Readonly<PlaywrightOptions>): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        requireFromRunner.resolve("@playwright/test/cli"),
        "test",
        ...playwrightArguments(),
      ],
      {
        env: {
          ...process.env,
          TEST_APP_PORT: String(clientPort),
          TEST_API_PORT: String(apiPort),
          ...(distDirectory === undefined
            ? {}
            : { TEST_APP_DIST: distDirectory }),
        },
        stdio: "inherit",
        detached: process.platform !== "win32",
      },
    );
    let interruptedExitCode: number | undefined;
    function interrupt() {
      interruptedExitCode = 130;
      child.kill("SIGINT");
    }
    function terminate() {
      interruptedExitCode = 143;
      // Playwright handles SIGINT by tearing down its managed web server.
      child.kill("SIGINT");
    }
    function removeSignalHandlers() {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
    }
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", terminate);
    child.once("error", (error) => {
      removeSignalHandlers();
      reject(error);
    });
    child.once("close", (code) => {
      removeSignalHandlers();
      resolve(interruptedExitCode ?? code ?? 1);
    });
  });
}

async function main() {
  const [clientPort, apiPort] = await Promise.all([
    availablePort(),
    availablePort(),
  ]);
  const distDirectory = process.env.CI
    ? await mkdtemp(join(tmpdir(), "bookkeeping-web-e2e-"))
    : undefined;
  try {
    if (distDirectory !== undefined) {
      await buildClient({
        apiOrigin: `http://localhost:${apiPort}`,
        distDirectory,
      });
    }
    // The Playwright config starts the database, the API, and the client.
    process.exitCode = await runPlaywright({
      clientPort,
      apiPort,
      distDirectory,
    });
  } finally {
    if (distDirectory !== undefined) {
      await rm(distDirectory, { recursive: true, force: true });
    }
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
