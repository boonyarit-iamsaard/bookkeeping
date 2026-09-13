import { afterAll, beforeAll } from "vitest";
import type { Database, DatabaseConnection } from "@/core/database/database";
import { createDatabase } from "@/core/database/database";
import { users } from "@/core/database/schema/auth";
import { testDatabaseUrl } from "./url";

const ROLLBACK = Symbol("rollback");

/**
 * Registers one connection per test file and runs each test inside a
 * transaction that is always rolled back, so tests never see each other.
 */
export function setupTestDatabase() {
  let connection: DatabaseConnection | undefined;

  beforeAll(() => {
    connection = createDatabase(testDatabaseUrl());
  });

  afterAll(async () => {
    await connection?.close();
  });

  return async function withRollback(
    run: (db: Database) => Promise<void>,
  ): Promise<void> {
    if (!connection) {
      throw new Error("Test database connection was not opened");
    }
    try {
      await connection.db.transaction(async (tx) => {
        await run(tx);
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) {
        throw error;
      }
    }
  };
}

let userSequence = 0;

export async function createTestUser(db: Database): Promise<{ id: string }> {
  userSequence += 1;
  const email = `user-${process.pid}-${Date.now()}-${userSequence}@test.local`;
  const [user] = await db
    .insert(users)
    .values({ name: "Test user", email })
    .returning({ id: users.id });
  if (!user) {
    throw new Error("Failed to insert test user");
  }
  return user;
}
