import { expect, test } from "@playwright/test";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("the categories screen shows both trees behind the kind switch", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await page.goto("/categories");

  const expense = page.getByRole("list", { name: "Expense categories" });
  await expect(expense).toBeVisible();
  await expect(
    expense.getByRole("button", { name: "Uncategorized" }),
  ).toBeVisible();
  await expect(
    expense.getByRole("button", { name: "Food & Drink" }),
  ).toBeVisible();
  await expect(
    expense.getByRole("button", { name: "Groceries" }),
  ).toBeVisible();

  await page.getByRole("radio", { name: "Income" }).click();
  const income = page.getByRole("list", { name: "Income categories" });
  await expect(income).toBeVisible();
  await expect(income.getByRole("button", { name: "Salary" })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Expense categories" }),
  ).toHaveCount(0);
});
