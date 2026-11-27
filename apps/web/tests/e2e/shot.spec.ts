import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { chooseDate } from "./helpers/choose-date";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

// Screenshots for a visual check, not a test: `pnpm test:e2e:shot` sets these.
const routes = process.env.SHOT_ROUTES?.split(",").filter(Boolean) ?? [];
const widths = (process.env.SHOT_WIDTHS ?? "1024,1440").split(",").map(Number);
const directory = process.env.SHOT_DIR ?? "test-results/shots";
// `SHOT_VIDEO=1` also records the run, such as a popover opening.
test.use({ video: process.env.SHOT_VIDEO ? "on" : "off" });

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

const TAG_NAMES = [
  "Anniversary dinner with the family",
  "Business travel reimbursable",
  "Christmas presents for everyone",
  "Dentist and other health costs",
  "Emergency household repairs",
  "Coffee",
  "Rent",
  "Gym",
  "Gifts",
  "Taxi",
  "Books",
  "Pets",
  "Utilities",
  "Weekend trip",
  "Subscriptions",
  "Lunch",
];

const itemsSchema = z.object({
  items: z.array(
    z.object({ id: z.string(), name: z.string(), kind: z.string().optional() }),
  ),
});
const idSchema = z.object({ id: z.string() });

/** `days` days before today, as an ISO date. */
function daysAgo(days: number): string {
  const day = new Date();
  day.setDate(day.getDate() - days);
  return day.toISOString().slice(0, 10);
}

/**
 * Enough for the #405 Design verification checks: 16 tags (some long), a
 * parent › child category, a second wallet and more than one 10-row page.
 * shortcut: stopgap sample data, replace with whatever #414 designs.
 */
async function seedVerificationLedger(page: Page) {
  await createWalletThroughForm(page, {
    name: "Joint household savings account",
    openingAmount: "250000",
    openingDate: "2025-01-01",
  });
  const apiOrigin = process.env.VITE_API_ORIGIN;
  const headers = { origin: new URL(page.url()).origin };
  const read = async (path: string) =>
    itemsSchema.parse(
      await (
        await page.request.get(`${apiOrigin}/v1/${path}`, { headers })
      ).json(),
    ).items;
  const post = async (path: string, data: object) => {
    const response = await page.request.post(`${apiOrigin}/v1/${path}`, {
      headers: { ...headers, "idempotency-key": randomUUID() },
      data,
    });
    expect(response.ok(), `POST ${path}: ${await response.text()}`).toBe(true);
    return idSchema.parse(await response.json()).id;
  };
  const wallets = await read("wallets");
  const cash = wallets.find((wallet) => wallet.name === "Cash")?.id;
  const savings = wallets.find((wallet) => wallet.name.startsWith("Joint"))?.id;
  const income = (await read("categories")).find(
    (item) => item.name === "Uncategorized" && item.kind === "income",
  )?.id;
  if (!(cash && savings && income)) {
    throw new Error("The seeded wallets or categories were not found");
  }
  const groceries = await post("categories", {
    kind: "expense",
    name: "Groceries at the night market",
    iconId: "beer",
    parent: { create: { name: "Food and drink", iconId: "beer" } },
  });
  const tagIds = [];
  for (const name of TAG_NAMES) {
    tagIds.push(await post("tags", { name }));
  }
  const amount = (value: string) => ({ value, currency: "THB" });
  for (let index = 0; index < 10; index += 1) {
    await post("transactions", {
      type: "expense",
      amount: amount(`${(index + 1) * 137}.25`),
      walletId: cash,
      categoryId: groceries,
      transactionDate: daysAgo(index * 9 + 1),
      note: index === 0 ? "Five long tags" : "",
      // At most five tags each; the rest spread so every tag is in use.
      tagIds:
        index === 0 ? tagIds.slice(0, 5) : tagIds.slice(index + 4, index + 7),
    });
  }
  await post("transactions", {
    type: "income",
    amount: amount("45000.00"),
    walletId: cash,
    categoryId: income,
    transactionDate: daysAgo(30),
    note: "",
    tagIds: [],
  });
  await post("transactions", {
    type: "transfer",
    amount: amount("5000.00"),
    walletId: cash,
    destinationWalletId: savings,
    transactionDate: daysAgo(20),
    note: "",
  });
  return cash;
}

test("shot", { tag: "@matrix" }, async ({ page }, testInfo) => {
  test.skip(routes.length === 0, "Runs only through pnpm test:e2e:shot");
  await signUpFreshUser(page);
  await seedSampleMoney(page);
  // A route may name the seeded Cash wallet as `:cash`, such as /wallets/:cash.
  const cash = await seedVerificationLedger(page);
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
