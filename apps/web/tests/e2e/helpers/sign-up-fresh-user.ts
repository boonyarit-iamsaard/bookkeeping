import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

let sequence = 0;

/** Registers a fresh user through the real sign-up screen. */
export async function signUpFreshUser(page: Page): Promise<{ email: string }> {
  sequence += 1;
  const email = `e2e-${Date.now()}-${process.pid}-${sequence}@test.local`;
  await page.goto("/sign-up");
  await expect(page.locator('form[data-ready="true"]')).toBeVisible();
  await page.getByLabel("Full Name").fill("E2E user");
  await page.getByLabel("Email").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct-horse-battery");
  await page.getByLabel("Confirm Password").fill("correct-horse-battery");
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/sign-up/email",
  );
  await page.getByRole("button", { name: /sign up|create account/i }).click();
  const response = await responsePromise;
  expect(response.ok(), "Fresh-user sign-up should succeed").toBe(true);
  await page.waitForURL(/\/(dashboard|wallets)/);
  await expect(
    page.getByRole("heading", { name: "Wallets", exact: true }),
  ).toBeVisible();
  return { email };
}
