import type { Database } from "@bookkeeping/database/connection";
import { createAuth } from "../config";

const TEST_SECRET = "integration-test-secret-with-at-least-32-chars";
const TEST_BASE_URL = "http://localhost:4000";

/** The shared configuration over a test database handle, with no app plugin. */
export function createTestAuth(db: Database) {
  return createAuth({ db, secret: TEST_SECRET, baseURL: TEST_BASE_URL });
}

let emailSequence = 0;

export function uniqueTestEmail(prefix: string): string {
  emailSequence += 1;
  return `${prefix}-${process.pid}-${Date.now()}-${emailSequence}@test.local`;
}
