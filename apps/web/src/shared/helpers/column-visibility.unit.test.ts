import { describe, expect, test } from "vitest";
import { readColumnVisibility } from "./column-visibility";

const COLUMNS = [
  { id: "date", hideable: false, hiddenByDefault: false },
  { id: "wallet", hideable: true, hiddenByDefault: false },
  { id: "note", hideable: true, hiddenByDefault: true },
];

describe("column visibility", () => {
  test("with nothing stored, optional columns show unless hidden by default", () => {
    expect(readColumnVisibility(null, COLUMNS)).toEqual({
      date: true,
      wallet: true,
      note: false,
    });
  });

  test("a stored choice replaces the defaults of optional columns", () => {
    expect(
      readColumnVisibility('{"wallet":false,"note":true}', COLUMNS),
    ).toEqual({ date: true, wallet: false, note: true });
  });

  test("a fixed column shows whatever is stored", () => {
    expect(readColumnVisibility('{"date":false}', COLUMNS).date).toBe(true);
  });

  test("an unreadable entry falls back to the defaults", () => {
    const defaults = { date: true, wallet: true, note: false };
    expect(readColumnVisibility("not json", COLUMNS)).toEqual(defaults);
    expect(readColumnVisibility('{"wallet":"no"}', COLUMNS)).toEqual(defaults);
  });
});
