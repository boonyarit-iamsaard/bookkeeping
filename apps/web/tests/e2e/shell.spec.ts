import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { popup } from "./helpers/popup";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { expectNoHorizontalOverflow, isDesktop } from "./helpers/viewport";

/**
 * A tappable area is the rendered control itself, never a padded parent: the
 * box must span at least 44 CSS pixels in both dimensions, width included.
 */
async function expectTouchTarget(control: Readonly<Locator>, minimum = 44) {
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(minimum - GEOMETRY_EPSILON);
  expect(box?.height).toBeGreaterThanOrEqual(minimum - GEOMETRY_EPSILON);
}

const TOUCH_TARGET_SELECTOR = [
  "a[href]",
  "button",
  'input:not([type="hidden"])',
  "textarea",
  "select",
  '[role="combobox"]',
  '[role="option"]',
  '[role="radio"]',
  '[data-slot="select-scroll-up-button"]',
  '[data-slot="select-scroll-down-button"]',
].join(", ");
const GEOMETRY_EPSILON = 0.01;

/** Visible controls inside one surface must have independent hit boxes. */
async function expectNoOverlappingTouchTargets(surface: Readonly<Locator>) {
  const boxes = await surface
    .locator(TOUCH_TARGET_SELECTOR)
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (
          element.closest('[aria-hidden="true"]') !== null ||
          style.display === "none" ||
          style.visibility !== "visible" ||
          style.pointerEvents === "none" ||
          rect.width === 0 ||
          rect.height === 0
        ) {
          return [];
        }
        let left = rect.left;
        let top = rect.top;
        let right = rect.right;
        let bottom = rect.bottom;
        for (
          let ancestor = element.parentElement;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const ancestorStyle = window.getComputedStyle(ancestor);
          const ancestorRect = ancestor.getBoundingClientRect();
          if (ancestorStyle.overflowX !== "visible") {
            const clipLeft = ancestorRect.left + ancestor.clientLeft;
            left = Math.max(left, clipLeft);
            right = Math.min(right, clipLeft + ancestor.clientWidth);
          }
          if (ancestorStyle.overflowY !== "visible") {
            const clipTop = ancestorRect.top + ancestor.clientTop;
            top = Math.max(top, clipTop);
            bottom = Math.min(bottom, clipTop + ancestor.clientHeight);
          }
        }
        left = Math.max(left, 0);
        top = Math.max(top, 0);
        right = Math.min(right, window.innerWidth);
        bottom = Math.min(bottom, window.innerHeight);
        if (right <= left || bottom <= top) {
          return [];
        }
        return [
          {
            label:
              element.getAttribute("aria-label") ??
              element.textContent?.trim() ??
              element.tagName,
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
          },
        ];
      }),
    );

  for (let first = 0; first < boxes.length; first += 1) {
    const firstBox = boxes[first];
    for (let second = first + 1; second < boxes.length; second += 1) {
      const secondBox = boxes[second];
      const overlapWidth =
        Math.min(firstBox.x + firstBox.width, secondBox.x + secondBox.width) -
        Math.max(firstBox.x, secondBox.x);
      const overlapHeight =
        Math.min(firstBox.y + firstBox.height, secondBox.y + secondBox.height) -
        Math.max(firstBox.y, secondBox.y);
      expect(
        overlapWidth > 0 && overlapHeight > 0,
        `Visible touch targets "${firstBox.label}" and "${secondBox.label}" overlap`,
      ).toBe(false);
    }
  }
}

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

test("phone controls keep a 44px touch target", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpFreshUser(page);
  const [year, monthIndex] = todayIn({ timeZone: APP_TIME_ZONE })
    .split("-")
    .map(Number);
  const monthLabel = `${new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthIndex - 1, 1)))} ${year}`;

  // Reports before any wallet exists: the month picker and the sole action.
  await page.goto("/reports");
  const month = page.getByLabel("Report month");
  await expectNoOverlappingTouchTargets(page.locator("main"));
  await expectTouchTarget(month);
  await month.click();
  const months = popup(page);
  await expect(months).toBeVisible();
  await expectTouchTarget(
    months.getByRole("button", { name: "Previous year" }),
  );
  await expectTouchTarget(months.getByRole("button", { name: "Next year" }));
  await expectTouchTarget(months.getByRole("button", { name: monthLabel }));
  await expectNoOverlappingTouchTargets(months);
  await page.keyboard.press("Escape");
  await expect(months).toBeHidden();
  await expectTouchTarget(page.getByLabel("Balance date"));
  await expectTouchTarget(page.getByRole("link", { name: "Create wallet" }));

  await page.goto("/wallets");
  await expectNoOverlappingTouchTargets(page.locator("main"));
  await expectTouchTarget(
    page.getByRole("link", { name: "Create your first wallet" }),
  );
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-09-01",
  });
  await expect(
    page.getByRole("region", { name: "Total balance" }),
  ).toContainText("Across 1 wallet");
  await expectTouchTarget(page.getByRole("link", { name: "New wallet" }));
  await page.getByRole("link", { name: "Cash", exact: true }).click();
  await expectTouchTarget(page.getByRole("link", { name: "Back to Wallets" }));
  await expectTouchTarget(page.getByRole("link", { name: "Manage" }));

  // A named wallet row in the report reaches 44px wide as well as tall.
  await page.goto("/reports");
  await expectTouchTarget(
    page.getByRole("link", { name: "Cash", exact: true }),
  );

  await page.goto("/transactions");
  await expectNoOverlappingTouchTargets(page.locator("main"));
  await expectTouchTarget(
    page.getByRole("link", { name: "Record a transaction" }),
  );

  // Record an expense so the destructive and refund actions are reachable.
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("80");
  await page.getByRole("button", { name: "Save −฿80.00 · Cash" }).click();
  await expectSavedRecord(page);
  const savedHref = await page.locator("[data-saved] a").getAttribute("href");
  if (!savedHref) {
    throw new Error("Missing saved expense link");
  }
  await page.goto(savedHref);
  await expectTouchTarget(page.getByRole("link", { name: "Record refund" }));

  // The destructive action shares the edit screen's footer.
  await page.goto(`${savedHref}/edit`);
  await expectTouchTarget(page.getByRole("button", { name: "Delete expense" }));

  await page.goto("/transactions?type=expense");
  await expectTouchTarget(
    page.getByRole("link", { name: "Remove filter Expense" }),
  );
  const filter = page.getByRole("button", { name: "Filter", exact: true });
  await expectTouchTarget(filter);
  await filter.click();
  const sheet = page.getByRole("dialog", { name: "Filter transactions" });
  await expectTouchTarget(sheet.getByRole("button", { name: "Apply filters" }));
  await expectTouchTarget(sheet.getByRole("button", { name: "Clear filters" }));
  await expectTouchTarget(sheet.getByRole("button", { name: "Close" }));
  await expectNoOverlappingTouchTargets(sheet);

  // A date picker: trigger, days, month arrows and Clear date all reach 44px,
  // and the calendar fits the phone column without horizontal overflow.
  const from = sheet.getByLabel("From date");
  await expectTouchTarget(from);
  await from.click();
  const calendar = popup(page);
  await expect(calendar).toBeVisible();
  await expectTouchTarget(calendar.locator("[data-date]").first());
  await expectTouchTarget(
    calendar.getByRole("button", { name: /previous month/i }),
  );
  await expectTouchTarget(
    calendar.getByRole("button", { name: /next month/i }),
  );
  await expectNoOverlappingTouchTargets(calendar);
  const calendarWidth = await calendar.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  expect(calendarWidth).toBeLessThanOrEqual(328);
  await expectNoHorizontalOverflow(page);
  await calendar.locator("[data-date]").first().click();
  await expect(calendar).toBeHidden();

  await from.click();
  await expect(calendar).toBeVisible();
  await expectTouchTarget(calendar.getByRole("button", { name: "Clear date" }));
  await expectNoOverlappingTouchTargets(calendar);
  await calendar.getByRole("button", { name: "Clear date" }).click();
  await expect(calendar).toBeHidden();

  // Select lists: options reach 44px and a long menu keeps its overflow
  // arrows at the phone minimum while scrolling.
  const wallet = sheet.getByLabel("Wallet", { exact: true });
  await expectTouchTarget(wallet);
  await wallet.click();
  await expect(wallet).toHaveAttribute("aria-expanded", "true");
  const walletOptions = page.locator(
    `[id="${await wallet.getAttribute("aria-controls")}"]`,
  );
  const allWallets = walletOptions.getByRole("option", { name: "All wallets" });
  await expectTouchTarget(allWallets);
  await expectNoOverlappingTouchTargets(walletOptions);
  await allWallets.click();
  await expect(wallet).toHaveAttribute("aria-expanded", "false");

  const category = sheet.getByLabel("Category", { exact: true });
  await expectTouchTarget(category);
  await category.click();
  await expect(category).toHaveAttribute("aria-expanded", "true");
  const categoryOptions = page.locator(
    `[id="${await category.getAttribute("aria-controls")}"]`,
  );
  await expectTouchTarget(categoryOptions.getByRole("option").first());
  await expectTouchTarget(
    page.locator("[data-slot=select-scroll-down-button]"),
  );
  await expectNoOverlappingTouchTargets(categoryOptions);
  // The menu's last option stays reachable: scrolling brings it fully inside
  // the visible list.
  const lastOption = categoryOptions.getByRole("option").last();
  await lastOption.scrollIntoViewIfNeeded();
  const listBox = await categoryOptions.boundingBox();
  const lastBox = await lastOption.boundingBox();
  expect(lastBox?.y).toBeGreaterThanOrEqual(listBox?.y ?? 0);
  expect((lastBox?.y ?? 0) + (lastBox?.height ?? 0)).toBeLessThanOrEqual(
    (listBox?.y ?? 0) + (listBox?.height ?? 0),
  );
  await categoryOptions.getByRole("option").first().click();
  await expect(category).toHaveAttribute("aria-expanded", "false");

  await sheet.getByRole("button", { name: "Apply filters" }).click();
  await expect(sheet).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

test("auth controls keep a 44px touch target", async ({ page }) => {
  await page.goto("/sign-in");
  const signInForm = page.locator("form");
  const signInEmail = page.getByLabel("Email");
  const signInPassword = page.getByLabel("Password", { exact: true });
  const signInButton = page.getByRole("button", { name: "Sign in" });
  await expectTouchTarget(signInEmail);
  await expectTouchTarget(signInPassword);
  await expectTouchTarget(signInButton);
  // The account switch is a separate action beneath the explanation.
  const signUpLink = page.getByRole("link", { name: "Sign up" });
  await expectTouchTarget(signUpLink);
  await expectNoOverlappingTouchTargets(signInForm);

  await page.goto("/sign-up");
  const signUpForm = page.locator("form");
  const signUpName = page.getByLabel("Full Name");
  const signUpEmail = page.getByLabel("Email");
  const signUpPassword = page.getByLabel("Password", { exact: true });
  const confirmPassword = page.getByLabel("Confirm Password");
  await expectTouchTarget(signUpName);
  await expectTouchTarget(signUpEmail);
  await expectTouchTarget(signUpPassword);
  await expectTouchTarget(confirmPassword);
  await expectTouchTarget(page.getByRole("button", { name: "Create Account" }));
  const signInLink = page.getByRole("link", { name: "Sign in" });
  await expectTouchTarget(signInLink);
  await expectNoOverlappingTouchTargets(signUpForm);
  await signInLink.click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await signUpFreshUser(page);
});

test("phone form controls keep a 44px touch target", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-09-01",
  });
  await page.goto("/transactions/new");
  await expectTouchTarget(page.getByLabel("Amount"));
  await expectTouchTarget(page.getByRole("button", { name: /^Save/ }));
  await expectTouchTarget(page.getByRole("button", { name: "Today" }));
  await expectTouchTarget(page.getByRole("button", { name: "Yesterday" }));
  const note = page.getByLabel("Note");
  await expectTouchTarget(note);
  // The fixed Save bar stays in the thumb zone as the form scrolls beneath it.
  await note.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expectNoOverlappingTouchTargets(page.locator("main"));

  // Segmented segments sit in a 52px track with a 4px inset on phone.
  const type = page.getByRole("radiogroup", { name: "Type" });
  await expectTouchTarget(type, 52);
  await expectTouchTarget(type.getByRole("radio", { name: "Expense" }));
  await expectNoOverlappingTouchTargets(type);

  const category = page.getByLabel("Category", { exact: true });
  await expectTouchTarget(category);
  await category.click();
  const picker = page.getByRole("dialog", { name: "Expense category" });
  const newCategory = picker.getByRole("button", { name: "New category" });
  await expectTouchTarget(newCategory);
  await newCategory.click();
  const browseIcons = page.getByRole("button", { name: "Browse all icons" });
  await expectTouchTarget(browseIcons);
  await browseIcons.click();
  const allIcons = picker.getByRole("radiogroup", { name: "All icons" });
  await expectTouchTarget(allIcons.getByRole("radio").first());
  await expectNoOverlappingTouchTargets(picker);
  await page.keyboard.press("Escape");

  // With a single wallet, a transfer offers its unblocking action.
  await type.getByRole("radio", { name: "Transfer" }).click();
  await expectTouchTarget(
    page.getByRole("link", { name: "Create another wallet" }),
  );
});
