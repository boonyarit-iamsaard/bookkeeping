import { APP_TIME_ZONE, addDays, todayIn } from "@bookkeeping/domain/dates";
import { expect, test } from "@playwright/test";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { isDesktop } from "./helpers/viewport";

// From 1024px entry forms open in a dialog over the current screen.

test.setTimeout(120_000);

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("from 1024px New transaction opens over the screen and saving keeps it there", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "The entry dialog is desktop-only");
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: addDays(todayIn({ timeZone: APP_TIME_ZONE }), -3),
  });

  await page.goto("/transactions?type=expense");
  const screenUrl = page.url();
  await page
    .getByRole("banner")
    .getByRole("link", { name: "New transaction" })
    .click();
  const dialog = page.getByRole("dialog", { name: "New transaction" });
  await expect(dialog).toBeVisible();
  expect(page.url()).toBe(screenUrl);

  await dialog.getByLabel("Amount").fill("14");
  await dialog.getByRole("button", { name: /^Save −/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Transaction saved.")).toBeVisible();
  expect(page.url()).toBe(screenUrl);
  // The screen behind refreshed its reads, so the new row is already listed.
  await expect(page.locator("main").getByText("14.00")).toBeVisible();

  // A direct load is still the page, not a dialog over nothing.
  await page.goto("/transactions/new");
  await expect(
    page.getByRole("heading", { name: "New transaction", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // On the page itself ＋ stays on it and keeps the first origin.
  await page.goto("/transactions/new?origin=%2Ftransactions%3Ftype%3Dexpense");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "New transaction" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const entryUrl = new URL(page.url());
  expect(entryUrl.pathname).toBe("/transactions/new");
  expect(entryUrl.searchParams.get("origin")).toBe(
    "/transactions?type=expense",
  );
});

test("the entry dialog ignores the scrim once changed and scopes Escape to a picker", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "The entry dialog is desktop-only");
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: addDays(todayIn({ timeZone: APP_TIME_ZONE }), -3),
  });
  await page.goto("/");
  const plus = page
    .getByRole("banner")
    .getByRole("link", { name: "New transaction" });
  const dialog = page.getByRole("dialog", { name: "New transaction" });

  // Pristine, the scrim closes it.
  await plus.click();
  await expect(dialog.getByLabel("Amount")).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(dialog).toHaveCount(0);

  // Changed, the scrim is ignored and ✕ still closes it.
  await plus.click();
  await dialog.getByLabel("Amount").fill("9");
  await page.mouse.click(8, 8);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Amount")).toHaveValue(/9/);

  // Escape in a nested picker closes only the picker.
  await dialog.getByRole("button", { name: /^Category/ }).click();
  const picker = page.getByRole("dialog", { name: "Expense category" });
  await expect(picker).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Category/ })).toBeFocused();

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe("/");
});
