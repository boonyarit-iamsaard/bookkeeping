import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { startTestDatabase } from "@bookkeeping/database/testing/start-database";

const requireFromRunner = createRequire(import.meta.url);
const API_READY_TIMEOUT_MS = 60_000;
const API_POLL_INTERVAL_MS = 250;
const serverDirectory = fileURLToPath(
  new URL("../../../server/", import.meta.url),
);

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

async function waitForOrigin(origin: string): Promise<void> {
  const deadline = Date.now() + API_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fetch(`${origin}/openapi.json`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, API_POLL_INTERVAL_MS));
    }
  }
  throw new Error(`The API server did not answer on ${origin} in time`);
}

interface ServerOptions {
  port: number;
  clientOrigin: string;
  environment: NodeJS.ProcessEnv;
}

/** Starts the Hono API from `apps/server` source and resolves once it answers. */
async function startApiServer({
  port,
  clientOrigin,
  environment,
}: Readonly<ServerOptions>): Promise<ChildProcess> {
  const origin = `http://localhost:${port}`;
  const child = spawn(
    process.execPath,
    [requireFromRunner.resolve("tsx/cli"), "src/server.ts"],
    {
      cwd: serverDirectory,
      env: {
        ...environment,
        PORT: String(port),
        BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
        BETTER_AUTH_URL: origin,
        CLIENT_ORIGINS: clientOrigin,
      },
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  const exited = once(child, "exit").then(() => {
    throw new Error("The API server exited before answering");
  });
  await Promise.race([waitForOrigin(origin), exited]);
  return child;
}

async function stopApiServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await exited;
}

interface PlaywrightOptions {
  clientPort: number;
  environment: NodeJS.ProcessEnv;
}

function runPlaywright({
  clientPort,
  environment,
}: Readonly<PlaywrightOptions>): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        requireFromRunner.resolve("@playwright/test/cli"),
        "test",
        ...process.argv.slice(2),
      ],
      {
        env: {
          ...environment,
          TEST_APP_PORT: String(clientPort),
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
  const clientOrigin = `http://localhost:${clientPort}`;
  const { container, environment } = await startTestDatabase();
  try {
    const apiServer = await startApiServer({
      port: apiPort,
      clientOrigin,
      environment,
    });
    try {
      process.exitCode = await runPlaywright({ clientPort, environment });
    } finally {
      await stopApiServer(apiServer);
    }
  } finally {
    await container.stop();
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
