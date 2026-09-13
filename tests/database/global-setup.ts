import type { TestProject } from "vitest/node";
import { startTestDatabase } from "./start-database";

export default async function setup(project: TestProject) {
  const { container, environment } = await startTestDatabase();
  project.provide("testDatabaseUrl", environment.DATABASE_URL);
  return async function teardown() {
    await container.stop();
  };
}
