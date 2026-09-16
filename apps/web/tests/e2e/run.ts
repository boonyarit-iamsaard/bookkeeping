import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { loadEnvFile } from "node:process";
import { startTestDatabase } from "../database/start-database";

loadEnvFile(".env");

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

async function main() {
  const port = await availablePort();
  const { container, environment } = await startTestDatabase();
  try {
    const exitCode = await new Promise<number>((resolve, reject) => {
      const requireFromRunner = createRequire(import.meta.url);
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
            TEST_APP_PORT: String(port),
            BETTER_AUTH_URL: `http://localhost:${port}`,
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
    process.exitCode = exitCode;
  } finally {
    await container.stop();
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
