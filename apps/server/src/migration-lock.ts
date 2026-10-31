// A migration waiting on a lock blocks every later query on that table, so
// the pre-deploy migrator gives up and fails the deploy instead of stalling
// the running app. Its own module, so tests can read it without running the
// migrator.
export const LOCK_TIMEOUT_MS = 5_000;
