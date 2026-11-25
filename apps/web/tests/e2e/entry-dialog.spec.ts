import { APP_TIME_ZONE, addDays, todayIn } from "@bookkeeping/domain/dates";
import { expect, test } from "@playwright/test";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
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

test("from 1024px Edit, Record refund and New wallet open over their screens", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "The entry dialog is desktop-only");
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: addDays(todayIn({ timeZone: APP_TIME_ZONE }), -3),
  });
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("500");
  await page.getByRole("button", { name: "Save −฿500.00 · Cash" }).click();
  await expectSavedRecord(page);
  await page.locator("[data-transaction-row]").getByRole("link").click();
  await expect(page.getByText("None recorded")).toBeVisible();
  const detailUrl = page.url();
  const main = page.locator("main");

  await page.setViewportSize({ width: 1024, height: 800 });
  const amount = await main
    .getByRole("region", { name: "Amount" })
    .boundingBox();
  const recorded = await main
    .getByText("Recorded", { exact: true })
    .boundingBox();
  expect(recorded?.x).toBeGreaterThan((amount?.x ?? 0) + (amount?.width ?? 0));
  await page.setViewportSize({ width: 1280, height: 800 });

  // Edit closes onto the detail with its new values.
  await main.getByRole("link", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit expense" });
  await expect(edit).toBeVisible();
  expect(page.url()).toBe(detailUrl);
  await edit.getByLabel("Amount").fill("450");
  await edit.getByRole("button", { name: "Save −฿450.00 · Cash" }).click();
  await expect(edit).toHaveCount(0);
  await expect(page.getByText("Changes saved.")).toBeVisible();
  expect(page.url()).toBe(detailUrl);
  await expect(main.getByText("450.00").first()).toBeVisible();

  // Record refund closes onto the detail with the refund listed.
  await main.getByRole("link", { name: "Record refund" }).click();
  const refund = page.getByRole("dialog", { name: "Record refund" });
  await refund.getByLabel("Amount").fill("50");
  await refund.getByRole("button", { name: "Save +฿50.00 · Cash" }).click();
  await expect(refund).toHaveCount(0);
  await expect(page.getByText("Refund saved.")).toBeVisible();
  expect(page.url()).toBe(detailUrl);
  await expect(
    main.getByRole("list", { name: "Linked refunds" }),
  ).toContainText("50.00");

  // Direct links load with the form skeleton and then show the form as a page.
  const detailRead = /\/v1\/transactions\/[0-9a-f-]+$/;
  await page.route(detailRead, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    await route.continue();
  });
  for (const [path, title] of [
    ["edit", "Edit expense"],
    ["refund", "Record refund"],
  ]) {
    await page.goto(`${detailUrl}/${path}`);
    await expect(page.getByRole("main", { name: "Loading" })).toContainText(
      "Loading entry form…",
    );
    await expect(
      page.getByRole("heading", { name: title, level: 1 }),
    ).toBeVisible();
    await expect(main.getByLabel("Amount")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.unroute(detailRead);

  // New wallet stays on Wallets, which lists it after Save.
  await page.goto("/wallets");
  await page.getByRole("link", { name: "New wallet" }).click();
  const wallet = page.getByRole("dialog", { name: "New wallet" });
  await wallet.getByLabel("Name").fill("Bank");
  await wallet.getByLabel("Opening balance").fill("200");
  await wallet.getByRole("button", { name: "Create wallet" }).click();
  await expect(wallet).toHaveCount(0);
  await expect(page.getByText("Wallet created.")).toBeVisible();
  await expect(page).toHaveURL(/\/wallets$/);
  await expect(
    page.locator("[data-wallet-row]").filter({ hasText: "Bank" }),
  ).toBeVisible();

  await page.goto("/wallets/new");
  await expect(
    page.getByRole("heading", { name: "New wallet", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
