import { describe, expect, it } from "vitest";
import * as z from "zod";
import { createCollectionResponseSchema } from "./collection.js";

describe("collection response schema", () => {
  const schema = createCollectionResponseSchema(z.object({ id: z.string() }));

  it("accepts items beside page metadata with a nullable next cursor", () => {
    expect(
      schema.safeParse({ items: [{ id: "w1" }], page: { nextCursor: null } })
        .success,
    ).toBe(true);
    expect(
      schema.safeParse({ items: [], page: { nextCursor: "opaque" } }).success,
    ).toBe(true);
  });

  it("rejects collections without page metadata or with foreign items", () => {
    expect(schema.safeParse({ items: [{ id: "w1" }] }).success).toBe(false);
    expect(
      schema.safeParse({ items: [{ name: "x" }], page: { nextCursor: null } })
        .success,
    ).toBe(false);
  });
});
