import type { UserConfig } from "@commitlint/types";
import { RuleConfigSeverity } from "@commitlint/types";
import { checkCommitBody } from "./scripts/commitlint/commit-body";
import {
  checkFeatureScope,
  FEATURE_SCOPES,
} from "./scripts/commitlint/feature-scope";
import { readStagedPaths } from "./scripts/commitlint/staged-paths";

const MERGE_OR_AUTOSQUASH_PATTERN = /^(Merge |(amend|fixup|squash)! )/;

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  // The default ignores also skip git's `Revert "..."` message, which must be
  // rewritten as a `revert:` subject instead.
  defaultIgnores: false,
  ignores: [(message) => MERGE_OR_AUTOSQUASH_PATTERN.test(message)],
  plugins: [
    {
      rules: {
        "body-empty-except-revert": ({ type, body }) =>
          checkCommitBody({ type, body }),
        "scope-matches-staged-feature": ({ scope }) =>
          checkFeatureScope({ scope, stagedPaths: readStagedPaths() }),
      },
    },
  ],
  rules: {
    "header-case": [RuleConfigSeverity.Error, "always", "lower-case"],
    "header-max-length": [RuleConfigSeverity.Error, "always", 72],
    "scope-enum": [RuleConfigSeverity.Error, "always", [...FEATURE_SCOPES]],
    "body-empty-except-revert": [RuleConfigSeverity.Error, "always"],
    "scope-matches-staged-feature": [RuleConfigSeverity.Error, "always"],
  },
};

export default config;
