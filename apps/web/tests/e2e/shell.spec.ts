import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { isDesktop } from "./helpers/viewport";

test("the tab bar navigates on phone and the header from 640px", {
  tag: "@matrix",
}, async ({ page }) => {
  await page.goto("/sign-in");
  await expect(
    page.getByText("Sign in to your account", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);

  await signUpFreshUser(page);
  const nav = page.getByRole("navigation", { name: "Primary" });
  const home = nav.getByRole("link", { name: "Home", exact: true });
  await expect(home).toHaveAttribute("aria-current", "page");
  if (isDesktop(page)) {
    // The wordmark leads Home too, but only the destination is current.
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Bookkeeping" }),
    ).not.toHaveAttribute("aria-current");
  } else {
    // Two equal halves put ＋ at the bar's exact centre.
    const bar = await nav.boundingBox();
    const capture = await nav
      .getByRole("link", { name: "New transaction" })
      .boundingBox();
    if (!bar || !capture) {
      throw new Error("Missing tab bar geometry");
    }
    expect(
      Math.abs(capture.x + capture.width / 2 - (bar.x + bar.width / 2)),
    ).toBeLessThan(1);
  }
  const wallets = nav.getByRole("link", { name: "Wallets", exact: true });
  await wallets.click();
  await expect(page).toHaveURL(/\/wallets$/);
  await expect(
    page.getByRole("heading", { name: "Wallets", level: 1 }),
  ).toBeVisible();
  await expect(wallets).toHaveAttribute("aria-current", "page");
  await expect(home).not.toHaveAttribute("aria-current");

  if (isDesktop(page)) {
    const header = page.getByRole("banner");
    await expect(
      header.getByRole("link", { name: "Bookkeeping" }),
    ).toBeVisible();
    for (const name of ["Home", "Transactions", "Wallets", "Reports"]) {
      await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await header.getByRole("link", { name: "New transaction" }).click();
  } else {
    await expect(page.getByRole("banner")).toHaveCount(0);
    for (const name of [
      "Home",
      "Transactions",
      "New transaction",
      "Wallets",
      "Reports",
    ]) {
      await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await nav.getByRole("link", { name: "Transactions", exact: true }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(
      nav.getByRole("link", { name: "Transactions", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(wallets).not.toHaveAttribute("aria-current");
    await nav
      .getByRole("link", { name: "New transaction", exact: true })
      .click();
  }

  await expect(page).toHaveURL(/\/transactions\/new\?origin=/);
  await expect(
    page.getByRole("heading", { name: "New transaction" }),
  ).toBeVisible();
  // A form owns the thumb zone, so the tab bar steps aside there.
  if (!isDesktop(page)) {
    await expect(nav).toHaveCount(0);
  }
});

test("back goes to the logical parent, even from a deep link", async ({
  page,
}) => {
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
  const detailHref = await page.locator("[data-saved] a").getAttribute("href");
  if (!detailHref) {
    throw new Error("Missing saved expense link");
  }

  await page.goto(`${detailHref}/edit`);
  await page.getByRole("link", { name: "Back to transaction" }).click();
  await expect(page).toHaveURL(new RegExp(`${detailHref}$`));
  // Detail keeps the tab bar so a destination stays one tap away.
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await page.getByRole("link", { name: "Back to Transactions" }).click();
  await expect(page).toHaveURL(/\/transactions$/);

  await page.goto(`${detailHref}/refund`);
  await page.getByRole("link", { name: "Back to transaction" }).click();
  await expect(page).toHaveURL(new RegExp(`${detailHref}$`));

  await page.goto("/wallets");
  await page.getByRole("link", { name: "Cash", exact: true }).click();
  await expect(page).toHaveTitle(/^Cash/);
  const walletUrl = page.url();
  await page.goto(`${walletUrl}/manage`);
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Back to Cash" }).click();
  await expect(page).toHaveURL(walletUrl);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await page.getByRole("link", { name: "Back to Wallets" }).click();
  await expect(page).toHaveURL(/\/wallets$/);
});

test("each tab keeps its scroll position", async ({ page }) => {
  await signUpFreshUser(page);
  // A short viewport makes Reports scroll without seeding many records.
  await page.setViewportSize({ width: 360, height: 420 });
  const nav = page.getByRole("navigation", { name: "Primary" });
  await nav.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(page.getByLabel("Balance date")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 160));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(160);

  await nav.getByRole("link", { name: "Transactions", exact: true }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  await nav.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(160);
});

test("phone controls keep a 44px touch target", async ({ page }) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-09-01",
  });

  async function expectTouchHeight(control: Locator) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box?.height).toBe(44);
  }

  await page.goto("/wallets");
  await expect(
    page.getByRole("region", { name: "Total balance" }),
  ).toContainText("Across 1 wallet");
  await expectTouchHeight(page.getByRole("link", { name: "New wallet" }));
  await page.getByRole("link", { name: "Cash", exact: true }).click();
  await expectTouchHeight(page.getByRole("link", { name: "Back to Wallets" }));
  await expectTouchHeight(page.getByRole("link", { name: "Manage" }));

  await page.goto("/transactions?type=expense");
  await expectTouchHeight(
    page.getByRole("link", { name: "Remove filter Expense" }),
  );
  const filter = page.getByRole("button", { name: "Filter", exact: true });
  await expectTouchHeight(filter);
  await filter.click();
  const sheet = page.getByRole("dialog", { name: "Filter transactions" });
  await expectTouchHeight(sheet.getByRole("button", { name: "Apply filters" }));
  await expectTouchHeight(sheet.getByRole("button", { name: "Clear filters" }));
  await expectTouchHeight(sheet.getByRole("button", { name: "Close" }));
});
