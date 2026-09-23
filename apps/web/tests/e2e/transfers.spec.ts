import { expect, test } from "@playwright/test";
import { chooseDate } from "./helpers/choose-date";
import { chooseOption } from "./helpers/choose-option";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { expectSavedRecord } from "./helpers/expect-saved-record";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test.afterEach(async ({ page }) => {
  expect(
    (await page.pageErrors({ filter: "all" })).map((error) => error.stack),
  ).toEqual([]);
});

test(
  "transfer From → To and swap survive a lost response and update both balances",
  { tag: "@matrix" },
  async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const phone = testInfo.project.name.startsWith("phone");
    await signUpFreshUser(page);
    await createWalletThroughForm(page, {
      name: "Cash",
      openingAmount: "12000",
      openingDate: "2026-09-01",
    });
    await createWalletThroughForm(page, {
      name: "Savings",
      openingAmount: "0",
      openingDate: "2026-09-05",
    });
    await createWalletThroughForm(page, {
      name: "Old",
      openingAmount: "0",
      openingDate: "2026-09-01",
    });
    // An archived wallet is never offered on either side of a transfer.
    await page.goto("/wallets");
    await page.getByRole("link", { name: "Old", exact: true }).click();
    await page
      .getByRole("button", { name: "Archive wallet", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Unarchive wallet", exact: true }),
    ).toBeVisible();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/transactions/new");
    await expect(page.getByLabel("Amount")).toBeFocused();
    await page.getByLabel("Amount").fill("1000.01");
    const dateBefore = await page
      .getByLabel("Date", { exact: true })
      .boundingBox();
    await page.getByRole("radio", { name: "Transfer" }).click();
    await expect(page.getByRole("button", { name: /^Category/ })).toHaveCount(
      0,
    );
    await expect(page.getByLabel("From", { exact: true })).toContainText(
      "Cash",
    );
    await expect(page.getByLabel("To", { exact: true })).toContainText(
      "Savings",
    );
    const dateAfter = await page
      .getByLabel("Date", { exact: true })
      .boundingBox();
    expect(
      Math.abs((dateAfter?.y ?? 0) - (dateBefore?.y ?? 0)),
    ).toBeLessThanOrEqual(48);
    // Archived Old is absent from both sides; the list must be open before
    // Escape, which otherwise cancels the whole form.
    for (const side of ["From", "To"]) {
      await page.getByLabel(side, { exact: true }).click();
      const listbox = page.getByRole("listbox");
      await expect(listbox).toBeVisible();
      await expect(listbox.getByRole("option")).toHaveCount(2);
      await expect(listbox.getByRole("option", { name: /^Old/ })).toHaveCount(
        0,
      );
      await page.keyboard.press("Escape");
      await expect(listbox).toBeHidden();
    }
    await page.getByRole("button", { name: "Swap wallets" }).click();
    await expect(
      page.getByRole("button", { name: "Swap wallets" }),
    ).toBeFocused();
    await expect(page.getByLabel("From", { exact: true })).toContainText(
      "Savings",
    );
    await expect(page.getByLabel("To", { exact: true })).toContainText("Cash");
    await chooseDate(page.getByLabel("Date", { exact: true }), "2026-09-04");
    await page
      .getByRole("button", { name: "Save ฿1,000.01 Savings → Cash" })
      .click();
    await expect(page.locator("#transactionDate-error")).toContainText(
      "5 Sep 2026",
    );
    await chooseDate(page.getByLabel("Date", { exact: true }), "2026-09-05");
    // The same wallet on both sides: pick From's current choice under To.
    await chooseOption(page.getByLabel("To", { exact: true }), "Savings");
    await page.getByRole("button", { name: /^Save/ }).click();
    await expect(page.locator("#destinationWalletId-error")).toContainText(
      "different destination",
    );
    await chooseOption(page.getByLabel("To", { exact: true }), "Cash");
    await expect(
      page.getByRole("button", { name: "Save ฿1,000.01 Savings → Cash" }),
    ).toBeEnabled();

    if (phone) {
      // Approximate the space left above a native keyboard; Playwright does not open one.
      await page.setViewportSize({ width: 360, height: 420 });
      const note = page.getByLabel("Note", { exact: false });
      await note.click();
      const noteBox = await note.boundingBox();
      const saveBox = await page
        .getByRole("button", { name: "Save ฿1,000.01 Savings → Cash" })
        .boundingBox();
      expect(noteBox).not.toBeNull();
      expect(saveBox).not.toBeNull();
      if (noteBox && saveBox) {
        expect(noteBox.y + noteBox.height).toBeLessThan(saveBox.y);
        expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(420);
        expect(saveBox.height).toBeGreaterThanOrEqual(48);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(360);
      await page.setViewportSize({ width: 360, height: 800 });
    }

    // The first response is lost after the server commits; the same
    // Idempotency-Key replays once and lands on the original transfer.
    let dropped = false;
    await page.route("**/v1/transactions", async (route) => {
      if (dropped || route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      dropped = true;
      await route.fetch();
      await route.abort("failed");
    });
    await page
      .getByRole("button", { name: "Save ฿1,000.01 Savings → Cash" })
      .click();
    await expectSavedRecord(page);
    await expect(page.locator("[data-transaction-row]")).toHaveCount(1);
    const row = page.locator("[data-transaction-row]");
    await expect(row).toContainText("Transfer");
    await expect(row).toContainText("Savings → Cash");
    await row.getByRole("link").click();
    await expect(page.locator("dl")).toContainText("FromSavings");
    await expect(page.locator("dl")).toContainText("ToCash");
    await expect(page.getByText("Category", { exact: true })).toHaveCount(0);
    await page.goto("/wallets");
    await expect(
      page.getByRole("listitem").filter({ hasText: /^Cash/ }),
    ).toContainText("฿13,000.01");
    await expect(
      page.getByRole("listitem").filter({ hasText: /^Savings/ }),
    ).toContainText("−฿1,000.01");
  },
);

test("one wallet explains why a transfer cannot be saved", async ({ page }) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "0",
    openingDate: "2026-09-01",
  });
  await page.goto("/transactions/new");
  await page.getByLabel("Amount").fill("10");
  await page.getByRole("radio", { name: "Transfer" }).click();
  await expect(
    page.getByText("Transfers need two active wallets."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Save/ })).toBeDisabled();
  await page.getByRole("radio", { name: "Expense" }).click();
  await expect(
    page.getByRole("button", { name: "Save −฿10.00 · Cash" }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: /^Category/ })).toHaveText(
    "Uncategorized",
  );
});
