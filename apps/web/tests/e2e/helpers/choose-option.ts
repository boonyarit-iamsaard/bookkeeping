import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Picks an option from one of the app's Select controls: opens the trigger,
 * then clicks the first option whose accessible name starts with `name` in
 * the list that trigger controls. Options carry secondary text after the name
 * (type, balance, Archived), so the match is anchored at the start rather
 * than exact. The search stays inside the trigger's own list because a Select
 * closed just before keeps its list mounted while it animates out, often over
 * the next trigger, and a page-wide match would click that stale option.
 */
export async function chooseOption(
  trigger: Locator,
  name: string,
): Promise<void> {
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const listId = await trigger.getAttribute("aria-controls");
  if (!listId) {
    throw new Error("The select trigger names no list it controls");
  }
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await trigger
    .page()
    .locator(`[id="${listId}"]`)
    .getByRole("option", { name: new RegExp(`^${escaped}(\\s|$)`) })
    .first()
    .click();
}
