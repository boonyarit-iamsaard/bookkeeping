/**
 * Identifiers that must never reach this public repository: account and
 * resource IDs, credentials, private hosts and personal email addresses.
 * Documents name them with placeholders such as `<BACKUPS_ACCOUNT_ID>`.
 */
const IDENTIFIER_PATTERNS = [
  { kind: "AWS account ID", pattern: /(?<![\w-])\d{12}(?!\d)/g },
  {
    kind: "AWS Organizations ID",
    pattern: /\bo-(?=[a-z\d]*\d)[a-z\d]{10,32}\b/g,
  },
  {
    kind: "AWS Organizations root ID",
    pattern: /\br-(?=[a-z\d]*\d)[a-z\d]{4,32}\b/g,
  },
  { kind: "IAM Identity Center instance", pattern: /\bssoins-[\da-f]{16}\b/g },
  { kind: "IAM Identity Center store", pattern: /\bd-[\da-f]{10}\b/g },
  {
    kind: "IAM Identity Center permission set",
    pattern: /\bps-[\da-f]{16}\b/g,
  },
  { kind: "AWS access key ID", pattern: /\b(?:AKIA|ASIA)[\dA-Z]{16}\b/g },
  { kind: "age private key", pattern: /AGE-SECRET-KEY-1[\dA-Z]{58}/g },
  {
    kind: "Railway TCP proxy host",
    pattern: /\b[a-z\d-]+\.proxy\.rlwy\.net\b/g,
  },
  {
    kind: "personal email address",
    pattern:
      /[\w.%+-]+@(?:gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|proton|protonmail)\.[a-z.]{2,}/gi,
  },
] as const;

export interface PublicIdentifierFinding {
  line: number;
  kind: string;
}

/**
 * Lists each identifier in `text` by line and kind. The matched value is left
 * out, so reporting a finding never publishes it in a CI log.
 */
export function findPublicIdentifiers(text: string): PublicIdentifierFinding[] {
  const findings: PublicIdentifierFinding[] = [];

  for (const [index, lineText] of text.split("\n").entries()) {
    for (const { kind, pattern } of IDENTIFIER_PATTERNS) {
      for (const _match of lineText.matchAll(pattern)) {
        findings.push({ line: index + 1, kind });
      }
    }
  }

  return findings;
}
