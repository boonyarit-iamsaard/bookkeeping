import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { z } from "zod";

// Screenshots for a visual check, not a test: `pnpm test:e2e:shot` sets these.
const routes = process.env.SHOT_ROUTES?.split(",").filter(Boolean) ?? [];
const widths = (process.env.SHOT_WIDTHS ?? "1024,1440").split(",").map(Number);
const directory = process.env.SHOT_DIR ?? "test-results/shots";
// `SHOT_VIDEO=1` also records the run, such as a popover opening.
test.use({ video: process.env.SHOT_VIDEO ? "on" : "off" });

const credentialsSchema = z.object({ email: z.string(), password: z.string() });
const walletsSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string() })),
});

/** The test API writes the seeded demo Account's credentials to this file. */
async function readDemoCredentials() {
  const file = process.env.TEST_DEMO_CREDENTIALS_FILE;
  if (!file) {
    throw new Error("The shot spec needs TEST_DEMO_CREDENTIALS_FILE");
  }
  return credentialsSchema.parse(JSON.parse(await readFile(file, "utf8")));
}

/** Signs in as the demo Account the test API seeded at startup. */
async function signInAsDemoAccount(page: Page) {
  const { email, password } = await readDemoCredentials();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
}

/** The sample ledger's Cash wallet id, for a route that names it as `:cash`. */
async function cashWalletId(page: Page): Promise<string> {
  const response = await page.request.get(
    `${process.env.VITE_API_ORIGIN}/v1/wallets`,
    { headers: { origin: new URL(page.url()).origin } },
  );
  const cash = walletsSchema
    .parse(await response.json())
    .items.find((wallet) => wallet.name === "Cash");
  if (!cash) {
    throw new Error("The sample ledger has no Cash wallet");
  }
  return cash.id;
}

test("shot", { tag: "@matrix" }, async ({ page }, testInfo) => {
  test.skip(routes.length === 0, "Runs only through pnpm test:e2e:shot");
  await signInAsDemoAccount(page);
  // A route may name the Cash wallet as `:cash`, such as /wallets/:cash.
  const cash = await cashWalletId(page);
  const project = testInfo.project.name;
  for (const route of routes) {
    const name =
      route.replace(/^\/|\/$/g, "").replace(/[^\w-]+/g, "-") || "home";
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1100 });
        await page.goto(route.replace(":cash", cash));
        await page.waitForLoadState("networkidle");
        const path = resolve(
          `${directory}/${project}-${name}-${width}-${scheme}.png`,
        );
        await page.screenshot({ path, fullPage: true });
        console.log(path);
        // A screen with a Filters popover is shot again with it open.
        const filters = page.getByRole("button", { name: /^Filters/ });
        if ((await filters.count()) > 0) {
          await filters.click();
          await expect(
            page.getByRole("search", { name: "Filter transactions" }),
          ).toBeVisible();
          const open = path.replace(/\.png$/, "-filters.png");
          await page.screenshot({ path: open, fullPage: true });
          console.log(open);
          await page.keyboard.press("Escape");
        }
        // Shot again with the sidebar toggled, in a short window scrolled so
        // the sticky table header sits under an overlaid panel, then toggled
        // back so the saved choice is unchanged.
        await page.setViewportSize({ width, height: 480 });
        await page.evaluate(() => window.scrollTo(0, 300));
        await page.keyboard.press("ControlOrMeta+b");
        const toggled = path.replace(/\.png$/, "-sidebar.png");
        await page.screenshot({ path: toggled });
        console.log(toggled);
        await page.keyboard.press("ControlOrMeta+b");
      }
    }
  }
});
