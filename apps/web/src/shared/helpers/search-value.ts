import { z } from "zod";

/**
 * One single-choice control's raw text from the address. An empty control
 * means no value. The router reads `?type=7` as a number; the control still
 * shows that text, so validation rejects it rather than filtering by it. A
 * repeated parameter reads as the text `invalid`, so it fails validation
 * instead of disappearing.
 */
export const searchValue = z.preprocess((value) => {
  if (typeof value === "string") {
    return value === "" ? undefined : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return value === undefined ? undefined : "invalid";
}, z.string().optional());
