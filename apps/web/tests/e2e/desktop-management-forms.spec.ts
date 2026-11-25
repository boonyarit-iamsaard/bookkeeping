import { randomUUID } from "node:crypto";
import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { isDesktop } from "./helpers/viewport";

// From 1024px the wallet, category and tag forms that open in dialogs share
// the desktop form layout: a scrolling body and a pinned Cancel and Save.

test.setTimeout(120_000);
const ROUND_TRIP = { timeout: 20_000 };

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

test("the New wallet dialog pairs the opening fields, pins its footer, saves on Enter and closes on Escape", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "The desktop wallet form is desktop-only");
  await signUpFreshUser(page);
  await page.goto("/wallets");
  const dialog = page.getByRole("dialog", { name: "New wallet" });
  const open = page.getByRole("link", { name: "New wallet" });

  await page.getByRole("link", { name: "Create your first wallet" }).click();
  await expectBeside(
    dialog.getByLabel("Opening balance"),
    dialog.getByLabel("Opening date"),
  );

  // With the window too short for the fields, only they scroll.
  await page.setViewportSize({ width: 1280, height: 480 });
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeInViewport();
  await expect(
    dialog.getByRole("button", { name: "Create wallet" }),
  ).toBeInViewport();
  await page.setViewportSize({ width: 1280, height: 800 });

  // Enter saves.
  await dialog.getByLabel("Name").fill("Bank");
  await dialog.getByLabel("Opening balance").fill("200");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0, ROUND_TRIP);
  await expect(page.getByText("Wallet created.")).toBeVisible();

  // Escape and Cancel close it.
  await open.click();
  await expect(dialog.getByLabel("Name")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await open.click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
});

test("a direct New wallet URL shows the same desktop form as a page with Cancel at its foot", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "The desktop wallet form is desktop-only");
  await signUpFreshUser(page);
  await page.goto("/wallets/new");
  const main = page.locator("main");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectBeside(
    main.getByLabel("Opening balance"),
    main.getByLabel("Opening date"),
  );
  // One Cancel, in the form's foot rather than the title bar.
  await expect(page.getByRole("link", { name: "Cancel" })).toHaveCount(1);

  await main.getByLabel("Name").fill("Cash");
  await main.getByLabel("Opening balance").fill("50");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/wallets(\?|$)/);

  await page.goto("/wallets/new");
  await expect(main.getByLabel("Name")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/wallets$/);
});

test("the Edit category dialog pins Cancel and Save and saves on Enter", {
  tag: "@matrix",
}, async ({ page }) => {
  test.skip(!isDesktop(page), "The desktop edit form is desktop-only");
  await signUpFreshUser(page);
  await page.goto("/categories");
  const expense = page.getByRole("table", { name: "Expense categories" });
  const dialog = page.getByRole("dialog", { name: "Edit category" });

  await expense.getByRole("button", { name: "Groceries", exact: true }).click();
  await expect(dialog.getByLabel("Name")).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 480 });
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeInViewport();
  await expect(
    dialog.getByRole("button", { name: "Save changes" }),
  ).toBeInViewport();
  await page.setViewportSize({ width: 1280, height: 800 });

  await dialog.getByLabel("Name").fill("Supermarket");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden(ROUND_TRIP);
  await expect(
    expense.getByRole("button", { name: "Supermarket", exact: true }),
  ).toBeVisible();

  await expense
    .getByRole("button", { name: "Supermarket", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expense
    .getByRole("button", { name: "Supermarket", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

test("the Edit tag dialog pins Cancel and Save and saves on Enter", {
  tag: "@matrix",
}, async ({ page, baseURL }) => {
  test.skip(!isDesktop(page), "The desktop edit form is desktop-only");
  await signUpFreshUser(page);
  const created = await page.request.post(
    `${process.env.VITE_API_ORIGIN}/v1/tags`,
    {
      headers: { origin: baseURL ?? "", "idempotency-key": randomUUID() },
      data: { name: "Coffee" },
    },
  );
  expect(created.ok()).toBe(true);
  await page.goto("/tags");
  const tags = page.getByRole("table", { name: "Tags", exact: true });
  const dialog = page.getByRole("dialog", { name: "Edit tag", exact: true });

  await tags.getByRole("button", { name: "Coffee", exact: true }).click();
  await expect(dialog.getByLabel("Name", { exact: true })).toBeFocused();
  // Nothing changed yet, so Save waits.
  await expect(
    dialog.getByRole("button", { name: "Save name" }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 1280, height: 480 });
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeInViewport();
  await expect(
    dialog.getByRole("button", { name: "Save name" }),
  ).toBeInViewport();
  await page.setViewportSize({ width: 1280, height: 800 });

  await dialog.getByLabel("Name", { exact: true }).fill("Espresso");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden(ROUND_TRIP);
  await expect(page.getByRole("status")).toHaveText("Coffee is now Espresso.");

  await tags.getByRole("button", { name: "Espresso", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await tags.getByRole("button", { name: "Espresso", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});
