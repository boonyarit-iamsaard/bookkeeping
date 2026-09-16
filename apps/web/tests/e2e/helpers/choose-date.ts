import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function popup(page: Page): Locator {
  return page.locator("[data-slot=popover-content]").last();
}

/** "September 2026" → months since year 0. */
function monthIndexOf(caption: string): number {
  const [name, year] = caption.trim().split(" ");
  return Number(year) * 12 + MONTHS.indexOf(name);
}

/**
 * Picks a day in one of the app's date pickers: opens the trigger, steps the
 * calendar to the day's month, and clicks the day. `date` is YYYY-MM-DD.
 */
export async function chooseDate(
  trigger: Locator,
  date: string,
): Promise<void> {
  const page = trigger.page();
  await trigger.click();
  const calendar = popup(page);
  await expect(calendar).toBeVisible();
  const [year, month] = date.split("-").map(Number);
  const target = year * 12 + (month - 1);
  for (let step = 0; step < 240; step += 1) {
    const caption = await calendar.locator(".rdp-caption_label").innerText();
    const shown = monthIndexOf(caption);
    if (shown === target) {
      break;
    }
    await calendar
      .getByRole("button", {
        name: shown < target ? /next month/i : /previous month/i,
      })
      .click();
  }
  await calendar.locator(`[data-date="${date}"]`).click();
  await expect(calendar).toBeHidden();
}

/**
 * Picks a month in the app's month picker: opens the trigger, steps the year,
 * and clicks the month. `month` is YYYY-MM.
 */
export async function chooseMonth(
  trigger: Locator,
  month: string,
): Promise<void> {
  const page = trigger.page();
  await trigger.click();
  const picker = popup(page);
  await expect(picker).toBeVisible();
  const year = Number(month.slice(0, 4));
  for (let step = 0; step < 100; step += 1) {
    const shown = Number(
      await picker.locator("[aria-live=polite]").innerText(),
    );
    if (shown === year) {
      break;
    }
    await picker
      .getByRole("button", {
        name: shown < year ? "Next year" : "Previous year",
      })
      .click();
  }
  await picker.locator(`[data-month="${month}"]`).click();
  await expect(picker).toBeHidden();
}
