import { expect, test } from "@playwright/test";
import { chooseOption } from "./helpers/choose-option";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("search picks either level, and a missing parent and child are created without leaving the form", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "500",
    openingDate: "2026-09-01",
  });
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("45");

  const category = page.getByRole("button", { name: /^Category/ });
  await expect(category).toHaveText("Uncategorized");
  await category.click();
  const panel = page.getByRole("dialog", { name: "Expense category" });
  await expect(panel).toBeVisible();
  const search = panel.getByRole("searchbox", { name: "Search categories" });
  await search.fill("groc");
  const group = panel.getByRole("list", { name: "Categories" });
  await expect(group.getByRole("button")).toHaveText([
    "Food & Drink",
    /Groceries/,
  ]);
  await group.getByRole("button", { name: "Groceries" }).click();
  await expect(panel).toBeHidden();
  await expect(category).toHaveText("Food & Drink › Groceries");
  await expect(page.getByLabel("Amount")).toHaveValue("45");

  await category.click();
  await search.fill("Bubble tea");
  await expect(group).toHaveCount(0);
  await panel.getByRole("button", { name: "Create “Bubble tea”" }).click();
  const create = page.getByRole("dialog", { name: "New expense category" });
  await expect(create.getByLabel("Name", { exact: true })).toHaveValue(
    "Bubble tea",
  );
  await expect(create.getByRole("radio", { name: "Coffee" })).toBeChecked();
  await chooseOption(
    create.getByLabel("Parent", { exact: true }),
    "New parent…",
  );
  const parentName = create.getByLabel("Parent name");
  await expect(parentName).toBeFocused();
  await parentName.fill("Drinks");
  await expect(create.getByRole("radio", { name: "Beer" })).toBeChecked();
  await create.getByRole("radio", { name: "Martini" }).check();
  await create.getByRole("button", { name: "Save category" }).click();

  await expect(create).toBeHidden();
  await expect(category).toHaveText("Drinks › Bubble tea");
  await expect(category).toBeFocused();
  await expect(page.getByLabel("Amount")).toHaveValue("45");
  await expect(page).toHaveURL(/\/transactions\/new$/);

  // Cancel the transaction: the categories were saved on their own.
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("60");
  await page.getByRole("button", { name: /^Category/ }).click();
  const reopened = page.getByRole("dialog", { name: "Expense category" });
  await reopened
    .getByRole("searchbox", { name: "Search categories" })
    .fill("drinks");
  const drinks = reopened.getByRole("list", { name: "Categories" });
  await expect(drinks.getByRole("button")).toHaveText(["Drinks", /Bubble tea/]);
  await drinks.getByRole("button", { name: "Bubble tea" }).click();
  await page.getByRole("button", { name: "Save −฿60.00 · Cash" }).click();
  await expect(page).toHaveURL(/\/transactions\?saved=/);
  await expect(
    page.locator("[data-transaction-row][data-saved]"),
  ).toContainText("Drinks › Bubble tea");
});

test("duplicate names are refused inline, and keys inside the panel never reach the transaction form", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "0",
    openingDate: "2026-09-01",
  });
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("12");
  await page.getByRole("radio", { name: "Income" }).click();

  const category = page.getByRole("button", { name: /^Category/ });
  await category.click();
  const panel = page.getByRole("dialog", { name: "Income category" });
  const search = panel.getByRole("searchbox", { name: "Search categories" });
  // Enter in the search box takes the first result; it never submits the form.
  await search.fill("sal");
  await search.press("Enter");
  await expect(panel).toBeHidden();
  await expect(category).toHaveText("Salary");
  await expect(page).toHaveURL(/\/transactions\/new$/);

  await category.click();
  await search.press("ArrowDown");
  await expect(
    panel.getByRole("button", { name: "Uncategorized" }),
  ).toBeFocused();
  await panel.getByRole("button", { name: "New category" }).click();
  const create = page.getByRole("dialog", { name: "New income category" });
  const name = create.getByLabel("Name", { exact: true });
  await expect(name).toBeFocused();
  await name.fill("  salary ");
  await name.press("Enter");
  await expect(create.getByRole("alert")).toContainText("already exists");
  await expect(name).toHaveValue("  salary ");
  await expect(page).toHaveURL(/\/transactions\/new$/);
  await expect(page.locator("[data-transaction-row]")).toHaveCount(0);

  await name.fill("   ");
  await create.getByRole("button", { name: "Save category" }).click();
  await expect(create.getByRole("alert")).toContainText("Enter a name");

  // Escape closes the panel only; the transaction form stays put.
  await name.press("Escape");
  await expect(create).toBeHidden();
  await expect(page).toHaveURL(/\/transactions\/new$/);
  await expect(page.getByLabel("Amount")).toHaveValue("12");
  await expect(category).toHaveText("Salary");
  await page.getByLabel("Amount").press("Escape");
  await expect(page).toHaveURL(/\/transactions$/);
});
