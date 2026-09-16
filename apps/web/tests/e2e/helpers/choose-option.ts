import type { Locator } from "@playwright/test";

/**
 * Picks an option from one of the app's Select controls: opens the trigger,
 * then clicks the first listed option whose accessible name starts with
 * `name`. Options carry secondary text after the name (type, balance,
 * Archived), so the match is anchored at the start rather than exact.
 */
export async function chooseOption(
  trigger: Locator,
  name: string,
): Promise<void> {
  await trigger.click();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await trigger
    .page()
    .getByRole("option", { name: new RegExp(`^${escaped}(\\s|$)`) })
    .first()
    .click();
}
