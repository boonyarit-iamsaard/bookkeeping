import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.TEST_APP_PORT ?? 4000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  // All sign-ups share the API server's production rate limiter.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "phone-chromium",
      // The narrowest supported phone; the milestone specifies 360px.
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } },
    },
    { name: "phone-webkit", use: { ...devices["iPhone 15"] } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `node ./node_modules/vite/bin/vite.js ${process.env.CI ? "preview" : ""} --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
    stdout: "ignore",
    stderr: "pipe",
    timeout: 120_000,
  },
});
