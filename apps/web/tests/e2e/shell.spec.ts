import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { expectNoOverlappingTouchTargets } from "./helpers/touch-targets";
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
  await expectNoOverlappingTouchTargets(nav);
  await expectNoOverlappingTouchTargets(page.locator("main"));
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
    await expectNoOverlappingTouchTargets(header);
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

/**
 * Chooses through the account control: menu radio items on desktop, which
 * keep the menu open, or the Account sheet's segmented control on phone.
 */
async function chooseAppearance(
  page: Page,
  { email, label }: Readonly<{ email: string; label: string }>,
) {
  await page.getByRole("button", { name: `Account: ${email}` }).click();
  if (isDesktop(page)) {
    const menu = page.getByRole("menu");
    const item = menu
      .getByRole("group", { name: "Appearance" })
      .getByRole("menuitemradio", { name: label });
    await item.click();
    await expect(item).toHaveAttribute("aria-checked", "true");
    await expect(menu).toBeVisible();
  } else {
    const sheet = page.getByRole("dialog", { name: "Account" });
    const segment = sheet
      .getByRole("radiogroup", { name: "Appearance" })
      .getByRole("radio", { name: label });
    await segment.click();
    await expect(segment).toBeChecked();
  }
  await page.keyboard.press("Escape");
}

test("the Appearance choice overrides the system and survives a reload", {
  tag: "@matrix",
}, async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  const { email } = await signUpFreshUser(page);
  const root = page.locator("html");
  const themeColor = page.locator('meta[name="theme-color"]');
  await expect(root).toHaveAttribute("data-scheme", "light");

  await chooseAppearance(page, { email, label: "Dark" });
  await expect(root).toHaveAttribute("data-scheme", "dark");
  await expect(themeColor).toHaveAttribute("content", "#14141c");

  // With every script file refused, only the inline pre-paint script can
  // apply the stored choice, so the first paint is already dark.
  await page.route("**/*", (route) =>
    route.request().resourceType() === "script"
      ? route.abort()
      : route.continue(),
  );
  await page.reload();
  await expect(root).toHaveAttribute("data-scheme", "dark");
  await expect(themeColor).toHaveAttribute("content", "#14141c");
  await page.unrouteAll();

  await page.reload();
  await chooseAppearance(page, { email, label: "System" });
  await expect(root).toHaveAttribute("data-scheme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveAttribute("data-scheme", "dark");
  await expect(themeColor).toHaveAttribute("content", "#14141c");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-scheme", "light");
  await expect(themeColor).toHaveAttribute("content", "#ffffff");
});
