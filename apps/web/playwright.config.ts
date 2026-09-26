import { defineConfig, devices } from "@playwright/test";

// `tests/e2e/run.ts` allocates free ports; a run started without it, such as
// from an editor, uses these fixed ones, clear of the dev servers' 4000 and
// 5000.
const PORT = Number(process.env.TEST_APP_PORT ?? 4100);
const API_PORT = Number(process.env.TEST_API_PORT ?? 5100);
const baseURL = `http://localhost:${PORT}`;
const apiOrigin = `http://localhost:${API_PORT}`;

// The dev server and the specs read the API origin from the environment, and
// the test API wins over any origin a developer's shell or `.env` sets.
// Playwright passes this environment to the web servers and the workers.
process.env.VITE_API_ORIGIN = apiOrigin;

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
  // test API switches its sign-up throttle off, so CI runs in parallel.
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
  // Playwright starts these in order, and before any global setup.
  webServer: [
    {
      // A throwaway PostgreSQL container and the Hono API from source.
      command: "node --import tsx tests/e2e/serve-api.ts",
      url: `${apiOrigin}/openapi.json`,
      env: { TEST_API_PORT: String(API_PORT), TEST_CLIENT_ORIGIN: baseURL },
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 30_000 },
      stdout: "ignore",
      stderr: "pipe",
      timeout: 180_000,
    },
    {
      command: `node ./node_modules/vite/bin/vite.js ${serveCommand} --port ${PORT} --strictPort`,
      url: baseURL,
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
      stdout: "ignore",
      stderr: "pipe",
      timeout: 120_000,
    },
  ],
});
