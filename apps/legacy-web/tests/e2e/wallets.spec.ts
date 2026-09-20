import { expect, test } from "@playwright/test";
import { z } from "zod";
import { chooseDate } from "./helpers/choose-date";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test("a new user creates a wallet and its opening balance survives a reload", async ({
  page,
}) => {
  await signUpFreshUser(page);

  await page.goto("/wallets");
  await expect(
    page.getByRole("heading", { name: "No wallets yet" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create your first wallet" }).click();
  await expect(page).toHaveURL(/\/wallets\/new$/);
  await expect(page.locator('form[data-ready="true"]')).toBeVisible();

  await page.getByLabel("Name").fill("Kasikorn savings");
  await page.getByRole("radio", { name: "Bank account" }).click();
  await page.getByLabel("Opening balance").fill("12000.5");
  await chooseDate(page.getByLabel("Opening date"), "2026-09-01");
  await page.getByRole("button", { name: "Create wallet" }).click();

  await expect(page).toHaveURL(/\/wallets(\?.*)?$/);
  const row = page
    .getByRole("listitem")
    .filter({ hasText: "Kasikorn savings" });
  await expect(row).toContainText("Bank account");
  await expect(row).toContainText("Opened 1 Sep 2026");
  await expect(row).toContainText("฿12,000.50");

  await page.reload();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Kasikorn savings" }),
  ).toContainText("฿12,000.50");
});

test("validation names the problem and keeps the typed values", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await page.goto("/wallets/new");
  // Wait for the form handlers before submitting validation input.
  await expect(page.locator('form[data-ready="true"]')).toBeVisible();

  await page.getByLabel("Name").fill("Petty cash");
  await page.getByLabel("Opening balance").fill("1.005");
  await page.getByRole("button", { name: "Create wallet" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "at most two decimals" }),
  ).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("Petty cash");
  await expect(page.getByLabel("Opening balance")).toHaveValue("1.005");
  await expect(page).toHaveURL(/\/wallets\/new$/);
});

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/wallets");
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/wallets/new");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("wallet mutations enforce session ownership and reject signed-out or invalid writes", async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const otherContext = await browser.newContext({ baseURL });
  try {
    const otherPage = await otherContext.newPage();
    await signUpFreshUser(otherPage);
    const sessionResponse = await otherPage.request.get(
      "/api/auth/get-session",
    );
    const otherSession = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await sessionResponse.json());

    await signUpFreshUser(page);
    await page.goto("/wallets/new");
    await expect(page.locator('form[data-ready="true"]')).toBeVisible();
    const name = "Savings for our family holiday and upcoming home renovation";
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Opening balance").fill("12.50");
    await chooseDate(page.getByLabel("Opening date"), "2026-09-01");

    // Modify the real browser submission, preserving its action identifier.
    await page.route("**/wallets/new", async (route) => {
      if (!route.request().headers()["next-action"]) {
        await route.continue();
        return;
      }
      const args = z
        .tuple([z.record(z.string(), z.unknown())])
        .parse(route.request().postDataJSON());
      await route.continue({
        postData: JSON.stringify([
          {
            ...args[0],
            ownerId: otherSession.user.id,
            userId: otherSession.user.id,
          },
        ]),
      });
    });
    const submissionPromise = page.waitForRequest((candidate) =>
      Boolean(candidate.headers()["next-action"]),
    );
    await page.getByRole("button", { name: "Create wallet" }).click();
    const submission = await submissionPromise;
    await expect(page).toHaveURL(/\/wallets(\?.*)?$/);
    await expect(
      page.getByRole("listitem").filter({ hasText: name }),
    ).toContainText("฿12.50");
    await otherPage.goto("/wallets");
    await expect(
      otherPage.getByRole("heading", { name: "No wallets yet" }),
    ).toBeVisible();

    const actionId = submission.headers()["next-action"];
    const contentType = submission.headers()["content-type"];
    if (!actionId || !contentType) {
      throw new Error("Wallet submission did not include action headers");
    }
    const origin = new URL(submission.url()).origin;
    const headers = {
      "next-action": actionId,
      "content-type": contentType,
      origin,
    };
    const data = JSON.stringify([
      {
        name: "Unauthorized wallet",
        type: "cash",
        openingAmount: "99",
        openingDate: "2026-09-01",
        ownerId: otherSession.user.id,
      },
    ]);
    // An invalid session cookie passes the optimistic proxy check but must fail
    // the action's database-backed session verification.
    const denied = await request.post(submission.url(), {
      headers: { ...headers, cookie: "better-auth.session_token=invalid" },
      data,
    });
    expect(await denied.text()).toContain("unauthenticated");

    const invalid = await page.request.post(submission.url(), {
      headers,
      data: JSON.stringify([
        {
          name: "Future wallet",
          type: "cash",
          openingAmount: "99",
          openingDate: "9999-12-31",
        },
      ]),
    });
    expect(await invalid.text()).toContain('"error":"invalid"');
    await page.reload();
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await otherPage.reload();
    await expect(
      otherPage.getByRole("heading", { name: "No wallets yet" }),
    ).toBeVisible();
  } finally {
    await otherContext.close();
  }
});
