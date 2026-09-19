import { describe, expect, it } from "vitest";
import {
  categoryUsageCollectionResponseSchema,
  presentCategoryUsage,
} from "./category.routes.js";

describe("presentCategoryUsage", () => {
  it("orders the entries by category id and never paginates", () => {
    const presented = presentCategoryUsage({
      "0199a000-0000-7000-8000-000000000002": 3,
      "0199a000-0000-7000-8000-000000000001": 1,
    });

    expect(presented).toEqual({
      items: [
        { categoryId: "0199a000-0000-7000-8000-000000000001", transactions: 1 },
        { categoryId: "0199a000-0000-7000-8000-000000000002", transactions: 3 },
      ],
      page: { nextCursor: null },
    });
    expect(
      categoryUsageCollectionResponseSchema.safeParse(presented).success,
    ).toBe(true);
  });

  it("presents no usage as an empty collection", () => {
    expect(presentCategoryUsage({})).toEqual({
      items: [],
      page: { nextCursor: null },
    });
  });
});
