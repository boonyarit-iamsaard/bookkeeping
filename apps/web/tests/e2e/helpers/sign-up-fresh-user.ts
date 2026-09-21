import { setTimeout as delay } from "node:timers/promises";
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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/sign-up/email",
    );
    await page.getByRole("button", { name: /sign up|create account/i }).click();
    const response = await responsePromise;
    if (response.status() !== 429) {
      expect(response.ok(), "Fresh-user sign-up should succeed").toBe(true);
      await page.waitForURL(/\/(dashboard|wallets)/);
      return { email };
    }
    await expect(
      page.getByRole("alert").filter({ hasText: "Too many requests" }),
    ).toBeVisible();
    const retryAfter = Number(
      response.headers()["x-retry-after"] ?? response.headers()["retry-after"],
    );
    if (!Number.isFinite(retryAfter) || retryAfter < 0 || retryAfter > 60) {
      throw new Error("Sign-up rate limiter returned an invalid Retry-After");
    }
    await delay((retryAfter + 1) * 1000);
  }
  throw new Error("Sign-up stayed rate limited after retries");
}
