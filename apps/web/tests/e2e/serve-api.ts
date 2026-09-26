import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { startTestDatabase } from "@bookkeeping/database/testing/start-database";

// Playwright starts this as a `webServer` before the client, so a run from
// the terminal and one from an editor both get a database and an API.
// Playwright polls the API until it answers, and sends SIGTERM when the run
// ends; this script then stops the API and the database.

const requireFromScript = createRequire(import.meta.url);
const serverDirectory = fileURLToPath(
  new URL("../../../server/", import.meta.url),
);

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`The browser test API needs ${name}`);
  }
  return value;
}

interface ServerOptions {
  port: number;
  clientOrigin: string;
  environment: NodeJS.ProcessEnv;
}

/** Starts the Hono API from `apps/server` source. */
function startApiServer({
  port,
  clientOrigin,
  environment,
}: Readonly<ServerOptions>): ChildProcess {
  return spawn(
    process.execPath,
    [requireFromScript.resolve("tsx/cli"), "src/server.ts"],
    {
      cwd: serverDirectory,
      env: {
        ...environment,
        PORT: String(port),
        BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
        BETTER_AUTH_URL: `http://localhost:${port}`,
        CLIENT_ORIGINS: clientOrigin,
        // Every spec signs up a fresh user, so parallel workers would trip
        // the sign-up throttle if a production NODE_ENV ever enabled it.
        AUTH_RATE_LIMIT_ENABLED: "false",
      },
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
}

async function stopApiServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await exited;
}

async function main() {
  const port = Number(requiredEnv("TEST_API_PORT"));
  const clientOrigin = requiredEnv("TEST_CLIENT_ORIGIN");
  const { container, environment } = await startTestDatabase();
  const apiServer = startApiServer({ port, clientOrigin, environment });
  // The container client can hold the event loop open, so exit explicitly.
  function stopAndExit(code: number) {
    process.off("SIGTERM", stopOnSignal);
    process.off("SIGINT", stopOnSignal);
    apiServer.off("exit", stopOnApiExit);
    stopApiServer(apiServer)
      .finally(() => container.stop())
      .then(
        () => process.exit(code),
        (error: unknown) => {
          console.error("Stopping the browser test API failed", error);
          process.exit(1);
        },
      );
  }
  function stopOnSignal() {
    stopAndExit(0);
  }
  function stopOnApiExit() {
    console.error("The API server exited early");
    stopAndExit(1);
  }
  process.once("SIGTERM", stopOnSignal);
  process.once("SIGINT", stopOnSignal);
  apiServer.once("exit", stopOnApiExit);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
