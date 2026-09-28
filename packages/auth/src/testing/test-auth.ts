/** A secret long enough for Better Auth, used only by this package's tests. */
export const TEST_SECRET = "integration-test-secret-with-at-least-32-chars";
export const TEST_BASE_URL = "http://localhost:4000";

/** An email no other test run uses, so rolled-back tests never collide. */
export function uniqueEmail(label: string): string {
  return `${label}-${process.pid}-${Date.now()}@test.local`;
}
