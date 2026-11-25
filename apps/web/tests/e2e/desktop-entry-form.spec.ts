import { APP_TIME_ZONE, addDays, todayIn } from "@bookkeeping/domain/dates";
import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { isDesktop } from "./helpers/viewport";

// From 1024px the transaction entry form is one desktop composition, in the
// entry dialog and as the page a direct URL opens.

test.setTimeout(120_000);

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

/** `right` starts to the right of `left`, in the same row of fields. */
async function expectBeside(left: Locator, right: Locator): Promise<void> {
  const [a, b] = await Promise.all([left.boundingBox(), right.boundingBox()]);
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(b?.x).toBeGreaterThan((a?.x ?? 0) + (a?.width ?? 0) - 1);
  expect(Math.abs((b?.y ?? 0) - (a?.y ?? 0))).toBeLessThan(80);
}

test("the entry dialog pairs related fields, pins its footer, saves on Enter and closes on Escape", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "The desktop entry form is desktop-only");
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

  // Related fields sit side by side: Amount beside Type, Wallet beside
  // Category, Date beside Note.
  await plus.click();
  await expectBeside(
    dialog.getByLabel("Amount"),
    dialog.getByRole("radio", { name: "Expense" }),
  );
  await expectBeside(
    dialog.getByLabel("Wallet", { exact: true }),
    dialog.getByRole("button", { name: /^Category/ }),
  );
  await expectBeside(
    dialog.getByRole("button", { name: "Today" }),
    dialog.getByLabel("Note"),
  );

  // With the window too short for the fields, only they scroll: Cancel and
  // Save stay in view.
  await page.setViewportSize({ width: 1280, height: 480 });
  await dialog.getByLabel("Note").scrollIntoViewIfNeeded();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeInViewport();
  await expect(dialog.getByRole("button", { name: /^Save/ })).toBeInViewport();
  await page.setViewportSize({ width: 1280, height: 800 });

  // Enter saves.
  await dialog.getByLabel("Amount").fill("21");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Transaction saved.")).toBeVisible();

  // Escape and Cancel close it.
  await plus.click();
  await expect(dialog.getByLabel("Amount")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await plus.click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
});

test("a direct entry URL shows the same desktop form as a page with Cancel at its foot", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "The desktop entry form is desktop-only");
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: addDays(todayIn({ timeZone: APP_TIME_ZONE }), -3),
  });

  await page.route(
    /\/v1\/wallets$/,
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      await route.continue();
    },
    { times: 1 },
  );
  await page.goto("/transactions/new?origin=%2Ftransactions");
  await expect(page.getByRole("main", { name: "Loading" })).toContainText(
    "Loading entry form…",
  );
  const main = page.locator("main");
  await expect(main.getByLabel("Amount")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectBeside(
    main.getByLabel("Amount"),
    main.getByRole("radio", { name: "Expense" }),
  );
  await expect(main.getByRole("button", { name: /^Save/ })).toBeVisible();
  // One Cancel, in the form's foot rather than the title bar.
  await expect(page.getByRole("link", { name: "Cancel" })).toHaveCount(1);

  // Enter saves and the page returns to where it opened from.
  await main.getByLabel("Amount").fill("33");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/transactions(\?|$)/);

  // Escape leaves the page the way Cancel does.
  await page.goto("/transactions/new?origin=%2Ftransactions");
  await expect(main.getByLabel("Amount")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/transactions$/);
});
