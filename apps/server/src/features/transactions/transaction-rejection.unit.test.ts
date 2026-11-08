import { describe, expect, test } from "vitest";
import {
  CREATE_FIELD_POINTERS,
  toFieldErrors,
  transactionFieldErrorSchema,
  UPDATE_FIELD_POINTERS,
} from "./transaction-rejection.js";

describe("transaction field errors", () => {
  test("a rule code never passes without the facts its message names", () => {
    expect(
      transactionFieldErrorSchema.safeParse({
        pointer: "#/amount/value",
        code: "exceeds-refundable",
      }).success,
    ).toBe(false);
  });

  test("tag rejections address the tag list in both create and update documents", () => {
    for (const pointers of [CREATE_FIELD_POINTERS, UPDATE_FIELD_POINTERS]) {
      expect(
        toFieldErrors({ field: "tagIds", code: "tag-not-found" }, pointers),
      ).toEqual([{ pointer: "#/tagIds", code: "tag-not-found" }]);
      expect(
        toFieldErrors({ field: "tagIds", code: "too-many-tags" }, pointers),
      ).toEqual([{ pointer: "#/tagIds", code: "too-many-tags" }]);
    }
  });
});
