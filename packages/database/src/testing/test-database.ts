import { afterAll, beforeAll } from "vitest";
import { users } from "../auth/auth.schema";
import type { Database, DatabaseConnection } from "../connection";
import { createDatabase } from "../connection";
import { testDatabaseUrl } from "./url";

const ROLLBACK = Symbol("rollback");

/**
 * Registers one connection per test file. `withRollback` runs a test inside a
 * transaction that is always rolled back, so tests never see each other.
 * `committed` hands out the pooled connection for tests that need more than
 * one concurrent transaction; those tests isolate themselves by owner.
 */
export function setupTestDatabase() {
  let connection: DatabaseConnection | undefined;

  beforeAll(() => {
    connection = createDatabase(testDatabaseUrl());
  });

  afterAll(async () => {
    await connection?.close();
  });

  function committed(): Database {
    if (!connection) {
      throw new Error("Test database connection was not opened");
    }
    return connection.db;
  }

  async function withRollback(
    run: (db: Database) => Promise<void>,
  ): Promise<void> {
    try {
      await committed().transaction(async (tx) => {
        await run(tx);
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) {
        throw error;
      }
    }
  }

  return { withRollback, committed };
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
