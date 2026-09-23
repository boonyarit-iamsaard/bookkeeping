import { expect, test } from "@playwright/test";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

// The header hides the wordmark below 640px (`max-sm:hidden`) so the nav fits
// a 360px phone, so the phone projects assert it is present but hidden.
const WORDMARK_MIN_WIDTH = 640;

test("the shell renders the header once signed in", { tag: "@matrix" }, async ({
  page,
}) => {
  await signUpFreshUser(page);
  await expect(page.getByRole("banner")).toBeVisible();
  // `/` redirects during the load, which WebKit reports as an interrupted load.
  await page.goto("/", { waitUntil: "commit" });
  await expect(page).toHaveURL(/\/wallets$/);
  const header = page.getByRole("banner");
  const wordmark = header.getByRole("link", {
    name: "Bookkeeping",
    includeHidden: true,
  });
  const nav = header.getByRole("navigation", { name: "Primary" });

  await expect(nav.getByRole("link", { name: "Wallets" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Transactions" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Categories" })).toBeVisible();

  const width = page.viewportSize()?.width ?? 0;
  if (width >= WORDMARK_MIN_WIDTH) {
    await expect(wordmark).toBeVisible();
  } else {
    await expect(wordmark).toBeAttached();
    await expect(wordmark).toBeHidden();
  }
});
