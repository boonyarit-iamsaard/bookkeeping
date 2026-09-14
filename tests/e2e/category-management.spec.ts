import { expect, test } from "@playwright/test";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

// One long flow through entry, management, and back; development compiles
// each route on first visit, and every save is a server round trip.
test.setTimeout(120_000);
const ROUND_TRIP = { timeout: 20_000 };

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("a parent with children explains why it stays, a child hands its entry up, and Uncategorized only changes icon", async ({
  page,
}, testInfo) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "500",
    openingDate: "2026-09-01",
  });
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("45");
  await page.getByRole("button", { name: /^Category/ }).click();
  const picker = page.getByRole("dialog", { name: "Expense category" });
  await picker
    .getByRole("searchbox", { name: "Search categories" })
    .fill("groc");
  await picker.getByRole("button", { name: "Groceries" }).click();
  await page.getByRole("button", { name: "Save −฿45.00 · Cash" }).click();
  await expect(page).toHaveURL(/\/transactions\?saved=/, ROUND_TRIP);

  await page.getByRole("link", { name: "Categories" }).click();
  // The first visit compiles the route in development.
  await page.waitForURL(/\/categories$/, { timeout: 30_000 });
  const tree = page.getByRole("list", { name: "Expense categories" });
  const rows = tree.getByRole("button");
  await expect(rows.first()).toHaveText(/Uncategorized/);
  await expect(rows.nth(1)).toHaveText(/Food & Drink/);
  await expect(rows.nth(2)).toHaveText(/Groceries.*1 entry/);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: testInfo.outputPath("categories.png"),
    fullPage: true,
  });

  // A parent with children: the sheet says why, and offers no removal.
  await rows.nth(1).click();
  const sheet = page.getByRole("dialog", { name: "Edit category" });
  await expect(sheet.getByLabel("Name")).toHaveValue("Food & Drink");
  await expect(sheet.getByLabel("Name")).toBeFocused();
  await expect(sheet.getByRole("heading", { name: "Remove" })).toBeVisible();
  await expect(sheet).toContainText(
    "A parent with children stays. Remove its 4 child categories first",
  );
  await expect(sheet.getByRole("button", { name: "Remove…" })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("parent-sheet.png"),
    fullPage: true,
  });
  await sheet.getByLabel("Name").fill("Food");
  await sheet.getByLabel("Name").press("Enter");
  await expect(sheet).toBeHidden(ROUND_TRIP);
  await expect(page.getByRole("status")).toHaveText(
    "Food & Drink is now Food.",
  );
  await expect(rows.nth(1)).toHaveText(/^Food/);
  await expect(rows.nth(1)).toBeFocused();

  // A duplicate rename is refused on the field, values kept.
  await rows.nth(2).click();
  await sheet.getByLabel("Name").fill(" restaurants ");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(sheet.getByRole("alert")).toContainText(
    "already exists",
    ROUND_TRIP,
  );
  await expect(sheet.getByLabel("Name")).toHaveValue(" restaurants ");

  // Removing the child moves its entry to the parent and says so.
  await expect(sheet).toContainText(
    "Removing Groceries moves its 1 entry, and any refunds linked to them, to Food.",
  );
  await sheet.getByRole("button", { name: "Remove…" }).click();
  await page.screenshot({
    path: testInfo.outputPath("child-confirm.png"),
    fullPage: true,
  });
  await sheet.getByRole("button", { name: "Remove Groceries" }).click();
  await expect(sheet).toBeHidden(ROUND_TRIP);
  await expect(page.getByRole("status")).toHaveText(
    "Groceries removed. 1 entry moved to Food.",
  );
  await expect(page.getByRole("status")).toBeFocused();
  await expect(tree.getByRole("button", { name: "Groceries" })).toHaveCount(0);
  await expect(rows.nth(1)).toHaveText(/Food.*1 entry/);
  await expect(rows.nth(2)).toHaveText("›Restaurants");

  // Uncategorized: the name is fixed, the icon is not, and there is no removal.
  await rows.first().click();
  await expect(sheet.getByLabel("Name")).toHaveValue("Uncategorized");
  await expect(sheet.getByLabel("Name")).toHaveAttribute("readonly", "");
  await expect(sheet).toContainText(
    "Uncategorized cannot be removed or renamed",
  );
  await expect(sheet.getByRole("button", { name: "Remove…" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Browse all icons" }).click();
  await sheet.getByRole("radio", { name: "Sparkles" }).first().check();
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Uncategorized has a new icon.",
    ROUND_TRIP,
  );

  // The other tree, and creation through the same form as entry.
  await page.getByRole("radio", { name: "Income" }).click();
  const income = page.getByRole("list", { name: "Income categories" });
  await expect(income.getByRole("button", { name: "Salary" })).toBeVisible();
  await page.getByRole("button", { name: "New category" }).click();
  const create = page.getByRole("dialog", { name: "New income category" });
  await create.getByLabel("Name", { exact: true }).fill("Royalties");
  await create.getByRole("button", { name: "Save category" }).click();
  await expect(create).toBeHidden(ROUND_TRIP);
  await expect(page.getByRole("status")).toHaveText("Royalties created.");
  await expect(income.getByRole("button", { name: "Royalties" })).toBeVisible();

  // Labels on existing entries follow the rename and the fallback.
  await page.goto("/transactions");
  await expect(page.locator("[data-transaction-row]")).toContainText("Food");
  await expect(page.locator("[data-transaction-row]")).not.toContainText(
    "Groceries",
  );
});
