import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import { chooseDate } from "./helpers/choose-date";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

// Screenshots for a visual check, not a test: `pnpm test:e2e:shot` sets these.
const routes = process.env.SHOT_ROUTES?.split(",").filter(Boolean) ?? [];
const widths = (process.env.SHOT_WIDTHS ?? "1024,1440").split(",").map(Number);
const directory = process.env.SHOT_DIR ?? "test-results/shots";

/** The 15th of last month, a day every report month has. */
function lastMonthDay(): string {
  const day = new Date();
  day.setDate(15);
  day.setMonth(day.getMonth() - 1);
  return day.toISOString().slice(0, 10);
}

/** Wide figures stress layout: a seven-digit wallet, income last month, an expense today. */
async function seedSampleMoney(page: Page) {
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1234567.89",
    openingDate: "2025-01-01",
  });
  await page.goto("/transactions/new");
  await page.getByRole("radio", { name: "Income" }).click();
  await page.getByLabel("Amount").fill("98765.43");
  await chooseDate(page.getByLabel("Date", { exact: true }), lastMonthDay());
  await page.getByRole("button", { name: /Save/ }).click();
  await expectSavedRecord(page);
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("12345.67");
  await page.getByRole("button", { name: /Save/ }).click();
  await expectSavedRecord(page);
}

test("shot", { tag: "@matrix" }, async ({ page }, testInfo) => {
  test.skip(routes.length === 0, "Runs only through pnpm test:e2e:shot");
  await signUpFreshUser(page);
  await seedSampleMoney(page);
  const project = testInfo.project.name;
  for (const route of routes) {
    const name =
      route.replace(/^\/|\/$/g, "").replace(/[^\w-]+/g, "-") || "home";
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1100 });
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        const path = resolve(
          `${directory}/${project}-${name}-${width}-${scheme}.png`,
        );
        await page.screenshot({ path, fullPage: true });
        console.log(path);
      }
    }
  }
});
