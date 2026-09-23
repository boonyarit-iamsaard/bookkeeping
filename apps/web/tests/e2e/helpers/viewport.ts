import type { Page } from "@playwright/test";

// The tab bar serves phones; from 640px the header carries the destinations.
const DESKTOP_MIN_WIDTH = 640;

export function isDesktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= DESKTOP_MIN_WIDTH;
}
