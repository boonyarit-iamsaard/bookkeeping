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

test("wallet mutations enforce session ownership and reject invalid writes", async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const otherContext = await browser.newContext({ baseURL });
  try {
    const otherPage = await otherContext.newPage();
    await signUpFreshUser(otherPage);
    await signUpFreshUser(page);

    const apiOrigin = process.env.VITE_API_ORIGIN;
    if (!apiOrigin) {
      throw new Error("The browser test has no API origin");
    }
    await page.goto("/wallets/new");
    await expect(page.locator('form[data-ready="true"]')).toBeVisible();
    const name = "Savings for our family holiday and upcoming home renovation";
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Opening balance").fill("12.50");
    await chooseDate(page.getByLabel("Opening date"), "2026-09-01");

    const creationResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/v1/wallets" &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Create wallet" }).click();
    const creation = await creationResponsePromise;
    const wallet = z.object({ id: z.string() }).parse(await creation.json());
    await expect(page).toHaveURL(/\/wallets(\?.*)?$/);

    const otherRead = await otherPage.request.get(
      `${apiOrigin}/v1/wallets/${wallet.id}`,
      { headers: { origin: baseURL ?? "" } },
    );
    expect(otherRead.status()).toBe(404);

    const denied = await request.post(`${apiOrigin}/v1/wallets`, {
      headers: {
        "content-type": "application/json",
        "idempotency-key": "anonymous-wallet",
        origin: baseURL ?? "",
      },
      data: {
        name: "Unauthorized wallet",
        type: "cash",
        openingAmount: { value: "99", currency: "THB" },
        openingDate: "2026-09-01",
      },
    });
    expect(denied.status()).toBe(401);

    const invalid = await page.request.post(`${apiOrigin}/v1/wallets`, {
      headers: {
        "content-type": "application/json",
        "idempotency-key": "invalid-wallet",
        origin: baseURL ?? "",
      },
      data: {
        name: "Future wallet",
        type: "cash",
        openingAmount: { value: "99", currency: "THB" },
        openingDate: "9999-12-31",
      },
    });
    expect(invalid.status()).toBe(422);
    await page.reload();
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(
      page.getByRole("listitem").filter({ hasText: name }),
    ).toContainText("฿12.50");
    await expect(
      otherPage.getByRole("heading", { name: "No wallets yet" }),
    ).toBeVisible();
  } finally {
    await otherContext.close();
  }
});

test("double-tapping Save creates one wallet", async ({ page }) => {
  await signUpFreshUser(page);
  await page.goto("/wallets/new");
  await expect(page.locator('form[data-ready="true"]')).toBeVisible();
  await page.getByLabel("Name").fill("Double-tap cash");
  await page.getByLabel("Opening balance").fill("25");

  await page
    .getByRole("button", { name: "Create wallet" })
    .evaluate((element) => {
      if (!(element instanceof HTMLButtonElement)) {
        throw new Error("The create control is not a button");
      }
      element.click();
      element.click();
    });

  await expect(page).toHaveURL(/\/wallets(\?.*)?$/);
  await expect(
    page.getByRole("listitem").filter({ hasText: "Double-tap cash" }),
  ).toHaveCount(1);
});

test("a lost create response replays without a duplicate or error", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await page.goto("/wallets/new");
  await expect(page.locator('form[data-ready="true"]')).toBeVisible();
  await page.getByLabel("Name").fill("Replay cash");
  await page.getByLabel("Opening balance").fill("75");

  let lostResponse = false;
  await page.route("**/v1/wallets", async (route) => {
    if (route.request().method() !== "POST" || lostResponse) {
      await route.continue();
      return;
    }
    lostResponse = true;
    const response = await route.fetch();
    await response.body();
    await route.abort("failed");
  });

  try {
    await page.getByRole("button", { name: "Create wallet" }).click();
    await expect(page).toHaveURL(/\/wallets(\?.*)?$/);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(
      page.getByRole("listitem").filter({ hasText: "Replay cash" }),
    ).toHaveCount(1);
  } finally {
    await page.unroute("**/v1/wallets");
  }
});
