import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.TEST_APP_PORT ?? 4000);
const baseURL = `http://localhost:${PORT}`;

// Under CI the runner builds the client with the API origin it allocated and
// previews that output; locally the dev server reads the origin from its env.
// Domain flows run on the narrowest phone only; specs tagged `@matrix` cover
// what differs by viewport, such as layout, guards, and the PWA. Chromium is
// the only supported engine (ADR 0007).
const MATRIX_ONLY = /@matrix/;

const serveCommand = process.env.CI
  ? `preview --outDir ${process.env.TEST_APP_DIST ?? "dist"}`
  : "";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  // One worker keeps a local run within the machine's resource limits; the
  // runner switches the API's sign-up throttle off, so CI runs in parallel.
  workers: process.env.CI ? 2 : 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // The production build installs a service worker that proxies API
    // fetches; `page.route` never sees a request the worker makes, so the
    // specs that mock the API would hit the real server. `pwa.spec.ts` opts
    // back in for the worker itself.
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "phone-chromium",
      // The narrowest supported phone; the milestone specifies 360px.
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } },
    },
    {
      name: "desktop-chromium",
      grep: MATRIX_ONLY,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `node ./node_modules/vite/bin/vite.js ${serveCommand} --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
    stdout: "ignore",
    stderr: "pipe",
    timeout: 120_000,
  },
});
