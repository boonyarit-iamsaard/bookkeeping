import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.TEST_APP_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  // All sign-ups share the app server's production rate limiter.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "phone",
      // The narrowest supported phone; the milestone specifies 360px.
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } },
    },
  ],
  webServer: {
    command: `node ./node_modules/next/dist/bin/next ${process.env.CI ? "start" : "dev"} --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
    // Next otherwise gives its dev child only 100ms to flush and unlock.
    env: { NEXT_EXIT_TIMEOUT_MS: "10000" },
    stdout: "ignore",
    stderr: "pipe",
    timeout: 120_000,
  },
});
