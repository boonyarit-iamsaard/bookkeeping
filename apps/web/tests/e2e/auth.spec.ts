import { expect, test } from "@playwright/test";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test("sign-up lands on wallets with the email in the account menu", {
  tag: "@matrix",
}, async ({ page }) => {
  const { email } = await signUpFreshUser(page);

  await expect(page).toHaveURL(/\/wallets$/);
  await page.getByRole("button", { name: `Account: ${email}` }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByText("Signed in as")).toBeVisible();
  await expect(menu.getByText(email)).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Categories" }).click();
  await expect(page).toHaveURL(/\/categories$/);
});

test("sign-in with wrong credentials shows the error and keeps the email", {
  tag: "@matrix",
}, async ({ page }) => {
  const { email } = await signUpFreshUser(page);
  await page.getByRole("button", { name: `Account: ${email}` }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/sign-in$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "Invalid email or password" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page).toHaveURL(/\/sign-in$/);
});

// The guard redirects while the document is still loading, which WebKit
// reports as an interrupted load, so these visits wait only for the commit.
test("the guard redirects each way", { tag: "@matrix" }, async ({ page }) => {
  await page.goto("/", { waitUntil: "commit" });
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByText("Sign in to your account", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);

  await signUpFreshUser(page);
  // The URL changes before the guard has read the session; leaving earlier
  // would abort that read in the document being unloaded.
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await page.goto("/sign-in", { waitUntil: "commit" });
  await expect(page).toHaveURL(/\/wallets$/);
  await page.goto("/sign-up", { waitUntil: "commit" });
  await expect(page).toHaveURL(/\/wallets$/);
});

test("sign out returns to sign-in and back navigation shows no app content", {
  tag: "@matrix",
}, async ({ page }) => {
  const { email } = await signUpFreshUser(page);
  await page.getByRole("button", { name: `Account: ${email}` }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByText("Sign in to your account", { exact: true }),
  ).toBeVisible();

  await page.goBack();

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(
    page.getByText("Sign in to your account", { exact: true }),
  ).toBeVisible();
});
