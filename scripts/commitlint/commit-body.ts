import type { RuleVerdict } from "./feature-scope";

const REVERT_BODY_PATTERN = /^This reverts commit [0-9a-f]{40}\.$/;

export interface CommitBodyInput {
  type: string | null;
  body: string | null;
}

/**
 * A commit message is its subject line plus trailers. The one allowed body is
 * the line `git revert` writes naming the reverted commit, on a revert.
 */
export function checkCommitBody({
  type,
  body,
}: Readonly<CommitBodyInput>): RuleVerdict {
  const text = body?.trim() ?? "";

  if (text === "") {
    return [true];
  }

  if (type === "revert" && REVERT_BODY_PATTERN.test(text)) {
    return [true];
  }

  return [
    false,
    type === "revert"
      ? 'body must be empty or only "This reverts commit <full sha>."'
      : "body must be empty; put the change in the subject line",
  ];
}
