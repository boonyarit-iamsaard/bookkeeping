import { describe, expect, it } from "vitest";
import { checkCommitBody } from "./commit-body";

const revertLine = `This reverts commit ${"bf8effa2".repeat(5)}.`;

describe("checkCommitBody", () => {
  it("accepts a missing or blank body", () => {
    expect(checkCommitBody({ type: "feat", body: null })).toEqual([true]);
    expect(checkCommitBody({ type: "feat", body: "  \n" })).toEqual([true]);
  });

  it("rejects prose in the body", () => {
    expect(checkCommitBody({ type: "fix", body: "Explain the fix." })).toEqual([
      false,
      "body must be empty; put the change in the subject line",
    ]);
  });

  it("accepts only the reverted commit line on a revert", () => {
    expect(checkCommitBody({ type: "revert", body: revertLine })).toEqual([
      true,
    ]);
    expect(
      checkCommitBody({ type: "revert", body: `${revertLine}\n\nBecause.` })[0],
    ).toBe(false);
    expect(
      checkCommitBody({
        type: "revert",
        body: "This reverts commit bf8effa.",
      })[0],
    ).toBe(false);
  });

  it("rejects the revert line on other types", () => {
    expect(checkCommitBody({ type: "fix", body: revertLine })[0]).toBe(false);
  });
});
