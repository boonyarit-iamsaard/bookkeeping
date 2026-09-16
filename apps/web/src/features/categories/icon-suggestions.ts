import type { IconDefinition } from "@/features/categories/icons";
import { ICON_CATALOG } from "@/features/categories/icons";

export const MAX_ICON_SUGGESTIONS = 6;

const PHRASE_SCORE = 100;
const TOKEN_SCORE = 30;
const PREFIX_SCORE = 10;
const SUBSTRING_SCORE = 4;
/** Shorter tokens only match whole tag tokens; "tv" must not hit "activity". */
const MIN_PREFIX_LENGTH = 3;
const MIN_SUBSTRING_LENGTH = 4;

/** Lowercase ASCII words, diacritics stripped, punctuation dropped. */
function normalize(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0)
    .map(stem);
}

/** A light plural fold so "groceries" and "grocery" compare equal. */
function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("sses")) {
    return token.slice(0, -2);
  }
  if (token.length > 4 && /(?:s|x|z|ch|sh)es$/.test(token)) {
    return token.slice(0, -2);
  }
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

interface IndexedIcon {
  definition: IconDefinition;
  order: number;
  phrases: ReadonlySet<string>;
  tokens: ReadonlySet<string>;
}

const INDEX: readonly IndexedIcon[] = ICON_CATALOG.map((definition, order) => {
  const phrases = new Set<string>();
  const tokens = new Set<string>();
  for (const tag of definition.tags) {
    const words = normalize(tag);
    phrases.add(words.join(" "));
    for (const word of words) {
      tokens.add(word);
    }
  }
  return { definition, order, phrases, tokens };
});

/** How many icons carry the token; common words like "bill" weigh less. */
const DOCUMENT_FREQUENCY: ReadonlyMap<string, number> = (() => {
  const counts = new Map<string, number>();
  for (const icon of INDEX) {
    for (const token of icon.tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return counts;
})();

/**
 * A rare token identifies an icon; a token shared by many says little.
 * "Electricity bill" should land on the plug, not on every icon tagged
 * "bill".
 */
function specificity(token: string): number {
  const frequency = DOCUMENT_FREQUENCY.get(token) ?? 1;
  return 1 / (1 + Math.log(frequency));
}

function tokenScore(token: string, tagTokens: ReadonlySet<string>): number {
  if (tagTokens.has(token)) {
    return TOKEN_SCORE;
  }
  let best = 0;
  if (token.length >= MIN_PREFIX_LENGTH) {
    for (const tagToken of tagTokens) {
      if (tagToken.startsWith(token)) {
        return PREFIX_SCORE;
      }
      if (token.length >= MIN_SUBSTRING_LENGTH && tagToken.includes(token)) {
        best = SUBSTRING_SCORE;
      }
    }
  }
  return best;
}

function score(icon: IndexedIcon, tokens: readonly string[]): number {
  let total = icon.phrases.has(tokens.join(" ")) ? PHRASE_SCORE : 0;
  for (const token of tokens) {
    total += specificity(token) * tokenScore(token, icon.tokens);
  }
  return total;
}

/**
 * Ranks catalog icons for a category name, strongest first: a whole-name
 * phrase, then whole tokens, then prefixes, then substrings. Ties fall back
 * to catalog order so the same name always gets the same list. An empty or
 * unmatched name yields nothing; the picker keeps its generic preselection.
 */
export function suggestIcons(query: string): IconDefinition[] {
  const tokens = normalize(query);
  if (tokens.length === 0) {
    return [];
  }
  return INDEX.map((icon) => ({ icon, score: score(icon, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.icon.order - b.icon.order)
    .slice(0, MAX_ICON_SUGGESTIONS)
    .map((entry) => entry.icon.definition);
}
