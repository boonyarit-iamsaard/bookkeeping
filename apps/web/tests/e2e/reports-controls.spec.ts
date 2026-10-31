import type { Page, Request } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { chooseDate } from "./helpers/choose-date";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

/**
 * Holds back the first read matching `holds` until the returned release is
 * called, so the earlier report stays on show while the other control is
 * picked; `started` resolves once that read has been sent.
 */
async function holdRead(page: Page, holds: (url: URL) => boolean) {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    holds,
    async (route) => {
      await held;
      // The second pick supersedes this read's navigation, which may cancel
      // the read before it is let through.
      await route.continue().catch(() => undefined);
    },
    { times: 1 },
  );
  const started = page.waitForRequest((request: Request) =>
    holds(new URL(request.url())),
  );
  return { started, release };
}

test("a balance date picked while a new month loads keeps that month", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await page.goto("/reports?month=2026-08&asOf=2026-08-31");
  await expect(page.getByLabel("Balance date")).toBeVisible();
  const monthRead = await holdRead(
    page,
    (url) =>
      url.pathname === "/v1/reports/category-spending" &&
      url.searchParams.get("month") === "2026-09",
  );

  await page.getByLabel("Report month").click();
  await page
    .getByRole("button", { name: "September 2026", exact: true })
    .click();
  await monthRead.started;
  await chooseDate(page.getByLabel("Balance date"), "2026-08-20");
  monthRead.release();
  await expect(page).toHaveURL(/\/reports\?month=2026-09&asOf=2026-08-20$/);
  await expect(page.getByLabel("Report month")).toHaveText("September 2026");
});

test("a month picked while a new balance date loads keeps that date", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await page.goto("/reports?month=2026-08&asOf=2026-08-31");
  await expect(page.getByLabel("Balance date")).toBeVisible();
  const dateRead = await holdRead(
    page,
    (url) =>
      url.pathname === "/v1/wallets" &&
      url.searchParams.get("asOf") === "2026-08-20",
  );

  await chooseDate(page.getByLabel("Balance date"), "2026-08-20");
  await dateRead.started;
  await page.getByLabel("Report month").click();
  await page.getByRole("button", { name: "July 2026", exact: true }).click();
  dateRead.release();
  await expect(page).toHaveURL(/\/reports\?month=2026-07&asOf=2026-08-20$/);
  await expect(page.getByLabel("Balance date")).toHaveText("20 Aug 2026");
});

test("a malformed value stays in the address when the other control changes", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await page.goto("/reports?month=not-a-month&asOf=2026-08-31");
  await chooseDate(page.getByLabel("Balance date"), "2026-08-20");
  await expect(page).toHaveURL(/\/reports\?month=not-a-month&asOf=2026-08-20$/);
  await expect(page.getByLabel("Report month")).toHaveText("Choose a month");

  await page.goto("/reports?month=2026-08&asOf=2026-02-30");
  await page.getByLabel("Report month").click();
  await page
    .getByRole("button", { name: "September 2026", exact: true })
    .click();
  await expect(page).toHaveURL(/\/reports\?month=2026-09&asOf=2026-02-30$/);
  await expect(page.getByLabel("Balance date")).toHaveText("Choose a date");
});
