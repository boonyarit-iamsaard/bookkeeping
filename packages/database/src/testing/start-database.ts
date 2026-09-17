import { exec } from "node:child_process";
import { promisify } from "node:util";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

const run = promisify(exec);

export async function startTestDatabase() {
  const container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("bookkeeping_test")
    .start();
  const environment = {
    ...process.env,
    DATABASE_URL: container.getConnectionUri(),
  };
  try {
    await run("pnpm --filter @bookkeeping/database db:push --force", {
      env: environment,
    });
  } catch (error) {
    await container.stop();
    throw error;
  }
  return { container, environment };
}
