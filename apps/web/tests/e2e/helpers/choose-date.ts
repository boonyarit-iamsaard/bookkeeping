import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { popup } from "./popup";

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

function monthIndexOf(caption: string): number {
  const [name, year] = caption.trim().split(" ");
  return Number(year) * 12 + MONTHS.indexOf(name);
}

/**
 * Opens the app's date picker and pages it to the month holding `date`
 * (YYYY-MM-DD), whatever month today puts it on; resolves to the calendar.
 */
export async function openCalendarAt(
  trigger: Locator,
  date: string,
): Promise<Locator> {
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
  return calendar;
}

/** Picks a day in the app's date picker; `date` is YYYY-MM-DD. */
export async function chooseDate(
  trigger: Locator,
  date: string,
): Promise<void> {
  const calendar = await openCalendarAt(trigger, date);
  await calendar.locator(`[data-date="${date}"]`).click();
  await expect(calendar).toBeHidden();
}
