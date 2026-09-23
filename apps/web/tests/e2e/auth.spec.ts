import { expect, test } from "@playwright/test";
import { signOut } from "./helpers/sign-out";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";
import { isDesktop } from "./helpers/viewport";

test("sign-up lands on Home, whose account control reaches Categories", {
  tag: "@matrix",
}, async ({ page }) => {
  const { email } = await signUpFreshUser(page);

  await expect(page).toHaveURL(/\/$/);
  const account = page.getByRole("button", { name: `Account: ${email}` });
  await expect(account).toHaveCount(1);
  if (!isDesktop(page)) {
    await expect(account).toHaveText(email.charAt(0).toUpperCase());
  }
  await account.click();
  if (isDesktop(page)) {
    const menu = page.getByRole("menu");
    await expect(menu.getByText("Signed in as")).toBeVisible();
    await expect(menu.getByText(email)).toBeVisible();
    // Categories sits above Sign out.
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Categories",
      "Sign out",
    ]);
    await menu.getByRole("menuitem", { name: "Categories" }).click();
  } else {
    const sheet = page.getByRole("dialog", { name: "Account" });
    await expect(sheet).toHaveAccessibleDescription(email);
    await expect(sheet.getByRole("listitem")).toHaveText([
      "Categories",
      "Sign out",
    ]);
    // The sheet is a dialog: Escape closes it and focus returns to the disc.
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(account).toBeFocused();
    await account.click();
    await sheet.getByRole("link", { name: "Categories" }).click();
    await expect(sheet).toBeHidden();
  }
  await expect(page).toHaveURL(/\/categories$/);
  await expect(
    page.getByRole("heading", { name: "Categories", exact: true }),
  ).toBeVisible();
});

test("the account control lives on Home alone", async ({ page }) => {
  const { email } = await signUpFreshUser(page);
  const account = page.getByRole("button", { name: `Account: ${email}` });
  await expect(account).toBeVisible();
  await page.getByRole("link", { name: "Wallets" }).click();
  await expect(
    page.getByRole("heading", { name: "Wallets", exact: true }),
  ).toBeVisible();
  await expect(account).toHaveCount(0);
});

test("sign-in with wrong credentials shows the error and keeps the email", {
  tag: "@matrix",
}, async ({ page }) => {
  const { email } = await signUpFreshUser(page);
  await signOut(page, email);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "Invalid email or password" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page).toHaveURL(/\/sign-in$/);

  await page
    .getByLabel("Password", { exact: true })
    .fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
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
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  await page.goto("/sign-in", { waitUntil: "commit" });
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/sign-up", { waitUntil: "commit" });
  await expect(page).toHaveURL(/\/$/);
});

test("sign out returns to sign-in and back navigation shows no app content", {
  tag: "@matrix",
}, async ({ page }) => {
  const { email } = await signUpFreshUser(page);
  await signOut(page, email);

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
