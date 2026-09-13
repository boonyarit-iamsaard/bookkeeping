import { expect, test } from "@playwright/test";
import {
  APP_TIME_ZONE,
  addDays,
  formatCalendarDate,
  todayIn,
} from "@/shared/helpers/dates";
import { createWalletThroughForm } from "./helpers/create-wallet";
import { signUpFreshUser } from "./helpers/sign-up-fresh-user";

test("quick entry: amount then Save records an expense and moves the wallet balance", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "12000",
    openingDate: "2026-09-01",
  });

  await page.goto("/transactions/new");
  const amount = page.getByLabel("Amount");
  await expect(amount).toBeFocused();
  await expect(page.getByRole("radio", { name: "Expense" })).toBeChecked();
  await expect(page.getByRole("button", { name: /^Category/ })).toHaveText(
    "Uncategorized",
  );
  await expect(page.getByRole("button", { name: "Today" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await expect(page.getByLabel("Wallet").locator("option:checked")).toHaveText(
    "Cash · Cash · ฿12,000.00",
  );
  await amount.fill("120");
  const save = page.getByRole("button", { name: "Save −฿120.00 · Cash" });
  await expect(save).toBeVisible();
  await save.click();

  await expect(page).toHaveURL(/\/transactions\?saved=/);
  const row = page.locator("[data-transaction-row][data-saved]");
  await expect(row).toContainText("Uncategorized");
  await expect(row).toContainText("Cash");
  await expect(row).toContainText("−฿120.00");

  await row.getByRole("link").click();
  await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]+$/);
  await expect(page.getByText("Recorded", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/\d{1,2} \w{3} \d{4}, \d{2}:\d{2}/),
  ).toBeVisible();

  await page.goto("/wallets");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Cash" }),
  ).toContainText("฿11,880.00");
});

test("a committed save whose response is lost is replayed without a duplicate", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "1000",
    openingDate: "2026-09-01",
  });
  await page.goto("/transactions/new");
  await expect(page.getByLabel("Amount")).toBeFocused();
  await page.getByLabel("Amount").fill("250");
  await page.getByLabel("Note", { exact: false }).fill("Lost response");

  // Let the server commit, then drop the response on the floor once.
  let dropped = false;
  await page.route("**/transactions/new", async (route) => {
    if (dropped || !route.request().headers()["next-action"]) {
      await route.continue();
      return;
    }
    dropped = true;
    await route.fetch();
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "Save −฿250.00 · Cash" }).click();

  await expect(page.getByRole("status")).toContainText(
    "response to your last save was lost",
  );
  await expect(page.getByLabel("Amount")).toBeDisabled();
  await expect(page.getByLabel("Amount")).toHaveValue("250");
  const retry = page.getByRole("button", { name: "Check and retry save" });
  await retry.click();

  await expect(page).toHaveURL(/\/transactions\?saved=/);
  await expect(page.locator("[data-transaction-row]")).toHaveCount(1);
  await expect(page.locator("[data-transaction-row]")).toContainText(
    "Lost response",
  );
  await page.goto("/wallets");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Cash" }),
  ).toContainText("฿750.00");
});

test("validation names the problem, keeps values, and income switches the category tree", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "0",
    openingDate: "2026-09-01",
  });
  await page.goto("/transactions/new");
  await expect(page.getByLabel("Amount")).toBeFocused();

  await page.getByLabel("Amount").fill("1.005");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "at most two decimals" }),
  ).toBeVisible();
  await expect(page.getByLabel("Amount")).toHaveValue("1.005");
  await expect(page.getByLabel("Amount")).toHaveAttribute(
    "aria-describedby",
    "amount-description amount-error",
  );
  await expect(page.locator("#amount-error")).toHaveText(
    "Use at most two decimals; satang is the smallest unit",
  );
  await expect(page).toHaveURL(/\/transactions\/new$/);

  await page.getByLabel("Amount").fill("50");
  await page.getByLabel("Date").fill("2026-08-31");
  await page.getByRole("button", { name: "Save −฿50.00 · Cash" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "opened on 1 Sep 2026" }),
  ).toBeVisible();
  await expect(page.getByLabel("Date")).toHaveValue("2026-08-31");
  await expect(page.getByLabel("Date")).toHaveAttribute(
    "aria-describedby",
    "transactionDate-error",
  );
  await expect(page.locator("#transactionDate-error")).toContainText(
    "opened on 1 Sep 2026",
  );

  await page.getByRole("radio", { name: "Income" }).click();
  const category = page.getByRole("button", { name: /^Category/ });
  await expect(category).toHaveText("Uncategorized");
  await page.getByLabel("Amount").fill("1000");
  await category.click();
  await page
    .getByRole("dialog", { name: "Income category" })
    .getByRole("button", { name: "Salary" })
    .click();
  await expect(category).toHaveText("Salary");
  await page.getByRole("button", { name: "Yesterday" }).click();
  await page.getByRole("button", { name: "Save +฿1,000.00 · Cash" }).click();

  await expect(page).toHaveURL(/\/transactions\?saved=/);
  const row = page.locator("[data-transaction-row][data-saved]");
  await expect(row).toContainText("Salary");
  await expect(row).toContainText("+฿1,000.00");
});

test("without a wallet the form is replaced by a creation action", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await page.goto("/transactions/new");
  await expect(
    page.getByRole("heading", { name: "Create a wallet first" }),
  ).toBeVisible();
  await expect(page.getByLabel("Amount")).toHaveCount(0);
  await page.getByRole("link", { name: "Create a wallet" }).click();
  await expect(page).toHaveURL(/\/wallets\/new$/);
});

test("Bangkok midnight refreshes date shortcuts without changing a chosen date", async ({
  page,
}) => {
  await signUpFreshUser(page);
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "0",
    openingDate: addDays(today, -3),
  });
  await page.clock.install({ time: new Date(`${today}T23:59:50+07:00`) });
  await page.goto("/transactions/new");
  const date = page.getByLabel("Date");
  await page.getByRole("button", { name: "Yesterday", exact: true }).click();
  await expect(date).toHaveValue(addDays(today, -1));
  const backdated = addDays(today, -2);
  await date.fill(backdated);
  await page.clock.fastForward(11_000);

  await expect(date).toHaveValue(backdated);
  await expect(date).toHaveAttribute("max", addDays(today, 1));
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(date).toHaveValue(addDays(today, 1));
  await page.getByRole("button", { name: "Yesterday", exact: true }).click();
  await expect(date).toHaveValue(today);
  await page.getByLabel("Amount").press("Escape");
  await expect(page).toHaveURL(/\/transactions$/, { timeout: 15_000 });
});

/** Records one expense through the form and lands on its detail page. */
async function recordExpenseThroughForm(
  page: Parameters<typeof signUpFreshUser>[0],
  { amount, note }: Readonly<{ amount: string; note: string }>,
) {
  await page.goto("/transactions/new");
  await expect(page.getByLabel("Amount")).toBeFocused();
  await page.getByLabel("Amount").fill(amount);
  await page.getByLabel("Note", { exact: false }).fill(note);
  await page.getByRole("button", { name: /^Save −/ }).click();
  await expect(page).toHaveURL(/\/transactions\?saved=/);
  await page
    .locator("[data-transaction-row][data-saved]")
    .getByRole("link")
    .click();
  await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]+$/);
}

test("editing loads the saved values, keeps the type fixed, and replaces the balance effect", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "12000",
    openingDate: "2026-09-01",
  });
  await recordExpenseThroughForm(page, { amount: "120", note: "Coffee" });
  const detailUrl = page.url();
  const recorded = await page
    .getByText(/\d{1,2} \w{3} \d{4}, \d{2}:\d{2}/)
    .textContent();

  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]+\/edit$/);
  await expect(
    page.getByRole("heading", { name: "Edit expense" }),
  ).toBeVisible();
  await expect(page.getByLabel("Amount")).toHaveValue("120.00");
  await expect(page.getByLabel("Note", { exact: false })).toHaveValue("Coffee");
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByText("The type is fixed once saved")).toBeVisible();
  await expect(page.getByText(/^Recorded .* Bangkok time/)).toContainText(
    recorded?.replace(/ Bangkok time$/, "") ?? "",
  );

  // Escape leaves the edit where it began.
  await page.getByLabel("Note", { exact: false }).press("Escape");
  await expect(page).toHaveURL(detailUrl);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/edit$/);

  await page.getByLabel("Amount").fill("150.5");
  await page.getByLabel("Date").fill("2026-09-02");
  await page.getByLabel("Note", { exact: false }).fill("Coffee and cake");
  await page.getByRole("button", { name: "Save −฿150.50 · Cash" }).click();

  await expect(page).toHaveURL(/\/transactions\?saved=/);
  const row = page.locator("[data-transaction-row][data-saved]");
  await expect(row).toContainText("−฿150.50");
  await expect(row).toContainText("2 Sep 2026");
  await expect(row).toContainText("Coffee and cake");
  await expect(page.locator("[data-transaction-row]")).toHaveCount(1);

  await page.goto("/wallets");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Cash" }),
  ).toContainText("฿11,849.50");
});

test("an invalid edit keeps the values and names the field; deleting removes the record and its effect", async ({
  page,
}) => {
  await signUpFreshUser(page);
  await createWalletThroughForm(page, {
    name: "Cash",
    openingAmount: "500",
    openingDate: "2026-09-01",
  });
  await recordExpenseThroughForm(page, { amount: "80", note: "Mistake" });
  await page.getByRole("link", { name: "Edit" }).click();

  await page.getByLabel("Date").fill("2026-08-31");
  await page.getByRole("button", { name: "Save −฿80.00 · Cash" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "opened on 1 Sep 2026" }),
  ).toBeVisible();
  await expect(page.getByLabel("Date")).toHaveValue("2026-08-31");
  await expect(page.getByLabel("Date")).toHaveAttribute(
    "aria-describedby",
    "transactionDate-error",
  );
  await expect(page).toHaveURL(/\/edit$/);

  await page.getByRole("button", { name: "Delete expense" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this expense?",
  });
  // The confirmation reads the saved record back, not the unsaved edit.
  await expect(dialog).toContainText(
    `−฿80.00 · Cash on ${formatCalendarDate(todayIn({ timeZone: APP_TIME_ZONE }))}`,
  );
  await dialog.getByRole("button", { name: "Keep it" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Date")).toHaveValue("2026-08-31");

  await page.getByRole("button", { name: "Delete expense" }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page).toHaveURL(/\/transactions\?deleted=1$/);
  await expect(page.getByRole("status")).toContainText("Transaction deleted");
  await expect(page.locator("[data-transaction-row]")).toHaveCount(0);
  await page.goto("/wallets");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Cash" }),
  ).toContainText("฿500.00");
});
