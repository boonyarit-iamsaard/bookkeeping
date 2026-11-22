/**
 * "1 wallet", "3 wallets": a count with its noun, in the singular only for
 * one. An irregular noun gives both forms: `["category", "categories"]`.
 */
export function pluralize(
  count: number,
  noun: string | readonly [singular: string, plural: string],
): string {
  const [singular, plural] =
    typeof noun === "string" ? [noun, `${noun}s`] : noun;
  return `${count} ${count === 1 ? singular : plural}`;
}
