import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { migrateDatabase } from "../migrate";

export async function startTestDatabase() {
  const container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("bookkeeping_test")
    .start();
  const databaseUrl = container.getConnectionUri();
  const environment = {
    ...process.env,
    DATABASE_URL: databaseUrl,
  };
  try {
    await migrateDatabase(databaseUrl);
  } catch (error) {
    await container.stop();
    throw error;
  }
  return { container, environment };
}
