import { describe, expect, test } from "vitest";
import { suggestIcons } from "@/features/categories/icon-suggestions";

function ids(query: string) {
  return suggestIcons(query).map((icon) => icon.id);
}

describe("icon recommendations", () => {
  test("an empty or blank query recommends nothing", () => {
    expect(ids("")).toEqual([]);
    expect(ids("   ")).toEqual([]);
  });

  test("a whole-name match leads and never more than six are returned", () => {
    expect(ids("Groceries")[0]).toBe("cart");
    expect(ids("food").length).toBeLessThanOrEqual(6);
    expect(ids("a").length).toBeLessThanOrEqual(6);
  });

  test("case, surrounding whitespace, and punctuation do not change the result", () => {
    expect(ids("  coffee & Snacks ")).toEqual(ids("coffee snacks"));
    expect(ids("GROCERIES")).toEqual(ids("groceries"));
  });

  test("a known compound outranks its parts: car insurance is insurance first, car second", () => {
    const [first, second] = ids("car insurance");
    expect(first).toBe("shield");
    expect(second).toBe("car");
  });

  test("a distinctive word outweighs one shared by many icons", () => {
    expect(ids("Electricity bill")[0]).toBe("plug");
    expect(ids("Dog food")[0]).toBe("dog");
  });

  test("short tokens only match whole tags, so 'tv' finds the television and not every 'tv' substring", () => {
    expect(ids("tv")[0]).toBe("tv");
    expect(ids("at")).toEqual([]);
  });

  test("a whole-token match outranks a prefix match, which outranks nothing", () => {
    expect(ids("bus")[0]).toBe("bus");
    expect(ids("busin")[0]).toBe("briefcase");
    expect(ids("xyzzy")).toEqual([]);
  });

  test("ties are broken by catalog order, so the same query always ranks the same", () => {
    expect(ids("gift")).toEqual(ids("gift"));
    expect(ids("shopping")[0]).toBe("bag");
  });
});
