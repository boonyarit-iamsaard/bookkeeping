import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { isDesktop } from "./helpers/viewport";

/** The element's box, failing the test when it has none rather than comparing nulls. */
async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("The element has no box");
  }
  return box;
}

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("the desktop grid pairs the net with the month, the charts, and the balances", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "Phone keeps its single column");
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-09-01",
  });
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("80");
  await page.getByRole("button", { name: "Save −฿80.00 · Cash" }).click();
  await expectSavedRecord(page);

  await page.goto("/reports");
  const net = page.getByRole("region", { name: "Net", exact: true });
  const month = page.locator(
    'section[aria-labelledby="monthly-totals-heading"]',
  );
  const categories = page.getByRole("region", { name: "Spending by category" });
  const trend = page.getByRole("region", { name: "Last six months" });
  const balances = page.getByRole("region", { name: "Wallet balances" });
  const overTime = page.getByRole("region", { name: "Balance over time" });
  await expect(net).toContainText("−฿80.00");
  await expect(balances.getByLabel("Balance date")).toBeVisible();

  // Each row's cards share one top and one height, the left beside the right.
  let previousBottom = 0;
  for (const [left, right] of [
    [net, month],
    [categories, trend],
    [balances, overTime],
  ]) {
    const leftBox = await boxOf(left);
    const rightBox = await boxOf(right);
    expect(rightBox.y).toBeCloseTo(leftBox.y, 0);
    expect(rightBox.height).toBeCloseTo(leftBox.height, 0);
    expect(rightBox.x).toBeGreaterThan(leftBox.x + leftBox.width - 1);
    expect(leftBox.y).toBeGreaterThan(previousBottom);
    previousBottom = leftBox.y + leftBox.height;
  }
  // 4 + 8, 6 + 6, 5 + 7 of twelve columns.
  const [netBox, monthBox] = [await boxOf(net), await boxOf(month)];
  expect(monthBox.width).toBeGreaterThan(netBox.width * 1.8);
  const [categoriesBox, trendBox] = [
    await boxOf(categories),
    await boxOf(trend),
  ];
  expect(trendBox.width).toBeCloseTo(categoriesBox.width, 0);
  const [balancesBox, overTimeBox] = [
    await boxOf(balances),
    await boxOf(overTime),
  ];
  expect(overTimeBox.width).toBeGreaterThan(balancesBox.width);

  // The month picker sits in the page header, above the grid.
  const heading = await boxOf(
    page.getByRole("heading", { name: "Reports", level: 1 }),
  );
  const picker = await boxOf(page.getByLabel("Report month"));
  expect(picker.y).toBeLessThan(heading.y + heading.height);
  expect(picker.y + picker.height).toBeLessThan(netBox.y);
});

test("loads the desktop grid without sample money, then reads an empty month as empty", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "Phone keeps its single column");
  await signUpFreshUser(page);
  await page.goto("/wallets");
  await page.route("**/v1/reports/monthly?*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await route.continue();
  });

  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Reports", exact: true })
    .click();
  await expect(page.getByText("Loading your report…")).toBeVisible();
  await expect(page.getByText(/฿/)).toHaveCount(0);
  // The skeleton is the grid in neutral blocks: two cards on its first row.
  const hero = page.locator("main[aria-busy='true'] .bg-hero");
  const first = await boxOf(hero);
  const second = await boxOf(hero.locator("xpath=following-sibling::*[1]"));
  expect(second.y).toBeCloseTo(first.y, 0);
  expect(second.x).toBeGreaterThan(first.x + first.width - 1);

  await expect(
    page.getByText("No income, expenses or refunds recorded this month."),
  ).toBeVisible();
  const net = await boxOf(
    page.getByRole("region", { name: "Net", exact: true }),
  );
  const month = await boxOf(
    page.locator('section[aria-labelledby="monthly-totals-heading"]'),
  );
  expect(month.y).toBeCloseTo(net.y, 0);
  expect(month.height).toBeCloseTo(net.height, 0);
  await expect(
    page.getByText("Add a wallet to begin tracking balances."),
  ).toBeVisible();
});
