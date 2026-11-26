import { describe, expect, test } from "vitest";
import { splitTagOverflow } from "./tag-overflow";

function tag(name: string) {
  return { id: name, name };
}

describe("tag overflow", () => {
  test("one tag or none shows whole, with nothing over", () => {
    expect(splitTagOverflow([])).toEqual({ shown: [], hidden: [] });
    expect(splitTagOverflow([tag("a")])).toEqual({
      shown: [tag("a")],
      hidden: [],
    });
  });

  test("past one, the first shows and the rest go to +N", () => {
    expect(splitTagOverflow([tag("a"), tag("b"), tag("c")])).toEqual({
      shown: [tag("a")],
      hidden: [tag("b"), tag("c")],
    });
  });
});
