import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import * as z from "zod";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

// The service worker is only emitted by the production build, which the
// runner serves when it sets `TEST_APP_DIST`; the dev server has none.
test.skip(
  () => process.env.TEST_APP_DIST === undefined,
  "The service worker only exists in the production build",
);
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "The install and offline checks are Chromium's",
);
// The shared config blocks the worker so `page.route` mocks hold elsewhere.
test.use({ serviceWorkers: "allow" });

const manifestSchema = z.object({
  name: z.string(),
  short_name: z.string(),
  start_url: z.string(),
  display: z.string(),
  theme_color: z.string(),
  background_color: z.string(),
  icons: z.array(
    z.object({
      src: z.string(),
      sizes: z.string(),
      purpose: z.string().optional(),
    }),
  ),
});

function apiPath(pathname: string): boolean {
  return pathname.startsWith("/v1") || pathname.startsWith("/api/auth");
}

/**
 * Resolves once the registered worker is active and controls the page. The
 * predicate stays synchronous: `waitForFunction` treats a pending promise
 * as a truthy result.
 */
async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(() =>
    navigator.serviceWorker.ready.then(() => undefined),
  );
  await page.waitForFunction(
    () =>
      navigator.serviceWorker.controller !== null &&
      navigator.serviceWorker.controller.state === "activated",
  );
}

/** Signs in, so the worker has seen API traffic, then cuts the network. */
async function signInThenGoOffline(
  page: Page,
  context: BrowserContext,
): Promise<void> {
  await signUpFreshUser(page);
  await waitForServiceWorker(page);
  await context.setOffline(true);
}

test("the manifest describes an installable standalone app", async ({
  page,
}) => {
  await page.goto("/sign-in");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#1f5ed9",
  );

  const response = await page.request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = manifestSchema.parse(await response.json());
  expect(manifest).toMatchObject({
    name: "Bookkeeping",
    short_name: "Bookkeeping",
    start_url: "/",
    display: "standalone",
    theme_color: "#1f5ed9",
    background_color: "#ffffff",
  });
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );
  expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) {
    const iconResponse = await page.request.get(`/${icon.src}`);
    expect(iconResponse.ok(), `${icon.src} should be served`).toBe(true);
    expect(iconResponse.headers()["content-type"]).toContain("image/png");
  }
});

test("an offline launch shows the fallback page until the network returns", async ({
  page,
  context,
}) => {
  await signInThenGoOffline(page, context);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "You're offline" }),
  ).toBeVisible();

  await context.setOffline(false);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(
    page.getByRole("heading", { name: "Wallets", exact: true }),
  ).toBeVisible();
});

test("API requests are never answered from cache", async ({
  page,
  context,
}) => {
  const apiOrigin = process.env.VITE_API_ORIGIN;
  if (!apiOrigin) {
    throw new Error("The browser test has no API origin");
  }
  // The signed-in wallets page has already fetched both endpoints online, so
  // a cached answer would be available if the worker stored one.
  await signInThenGoOffline(page, context);

  const cachedUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) {
      const requests = await (await caches.open(name)).keys();
      urls.push(...requests.map((request) => request.url));
    }
    return urls;
  });
  expect(cachedUrls.length).toBeGreaterThan(0);
  expect(cachedUrls.filter((url) => apiPath(new URL(url).pathname))).toEqual(
    [],
  );

  const results = await page.evaluate(async (origin) => {
    async function attempt(path: string) {
      try {
        const response = await fetch(`${origin}${path}`, {
          credentials: "include",
        });
        return { served: true, status: response.status };
      } catch {
        return { served: false };
      }
    }
    return {
      wallets: await attempt("/v1/wallets"),
      session: await attempt("/api/auth/get-session"),
    };
  }, apiOrigin);

  expect(results.wallets).toEqual({ served: false });
  expect(results.session).toEqual({ served: false });
});
