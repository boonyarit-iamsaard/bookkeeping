import { strykerBase } from "../../stryker.config.base.mjs";

export default {
  ...strykerBase,
  mutate: [
    ...strykerBase.mutate,
    // Application owns the tests for these rules; see docs/code-conventions.md#test-ownership.
    "!src/categories/category.types.ts",
    "!src/tags/tag.types.ts",
  ],
};
