import { describe, expect, test } from "vitest";
import { splitTagOverflow } from "./tag-overflow";

const tag = (name: string) => ({ id: name, name });

describe("tag overflow", () => {
  test("two tags or fewer all show, with nothing over", () => {
    expect(splitTagOverflow([])).toEqual({ shown: [], hidden: [] });
    expect(splitTagOverflow([tag("a"), tag("b")])).toEqual({
      shown: [tag("a"), tag("b")],
      hidden: [],
    });
  });

  test("past two, the first two show and the rest go to +N", () => {
    expect(
      splitTagOverflow([tag("a"), tag("b"), tag("c"), tag("d"), tag("e")]),
    ).toEqual({
      shown: [tag("a"), tag("b")],
      hidden: [tag("c"), tag("d"), tag("e")],
    });
  });
});
