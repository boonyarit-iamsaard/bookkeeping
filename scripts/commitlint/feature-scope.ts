/** The domain features a commit scope may name. */
export const FEATURE_SCOPES = [
  "accounts",
  "categories",
  "reports",
  "transactions",
  "wallets",
] as const;

export type FeatureScope = (typeof FEATURE_SCOPES)[number];

/**
 * The directory names that hold each feature's code under
 * `apps/<app>/src/features/` or `packages/<package>/src/`.
 */
const FEATURE_SCOPE_DIRECTORIES: Record<FeatureScope, readonly string[]> = {
  accounts: ["auth", "sign-up"],
  categories: ["categories"],
  reports: ["reports"],
  transactions: ["transactions"],
  wallets: ["wallets"],
};

const FEATURE_DIRECTORY_PATTERNS = [
  /^apps\/[^/]+\/src\/features\/([^/]+)\//,
  /^packages\/[^/]+\/src\/([^/]+)\//,
];

function findDirectoryScope(directory: string): FeatureScope | undefined {
  return FEATURE_SCOPES.find((scope) =>
    FEATURE_SCOPE_DIRECTORIES[scope].includes(directory),
  );
}

/** Lists the domain features the given repository paths belong to, sorted. */
export function findFeatureScopes(paths: readonly string[]): FeatureScope[] {
  const scopes = new Set<FeatureScope>();

  for (const path of paths) {
    for (const pattern of FEATURE_DIRECTORY_PATTERNS) {
      const directory = pattern.exec(path)?.[1];
      const scope = directory && findDirectoryScope(directory);

      if (scope) {
        scopes.add(scope);
      }
    }
  }

  return [...scopes].sort();
}

export interface FeatureScopeInput {
  scope: string | null;
  stagedPaths: readonly string[];
}

export type RuleVerdict = [valid: boolean, message?: string];

/**
 * A commit touching exactly one domain feature is scoped to it; a commit
 * touching none or several is unscoped. A message-only commit, such as a
 * message amend, stages nothing and is not judged.
 */
export function checkFeatureScope({
  scope,
  stagedPaths,
}: Readonly<FeatureScopeInput>): RuleVerdict {
  if (stagedPaths.length === 0) {
    return [true];
  }

  const touched = findFeatureScopes(stagedPaths);

  if (touched.length === 1) {
    const [feature] = touched;

    return scope === feature
      ? [true]
      : [
          false,
          `scope must be "${feature}" because the staged changes touch only the ${feature} feature`,
        ];
  }

  if (!scope) {
    return [true];
  }

  return touched.length === 0
    ? [
        false,
        "scope must be empty because the staged changes touch no domain feature",
      ]
    : [
        false,
        `scope must be empty because the staged changes touch several domain features (${touched.join(", ")})`,
      ];
}
