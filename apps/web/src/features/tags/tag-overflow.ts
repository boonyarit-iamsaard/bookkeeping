/** The chips a one-line table cell shows before a "+N" chip takes the rest. */
const SHOWN_TAGS = 2;

/** A row's tags, in the API's order, as the chips shown and the ones behind "+N". */
export function splitTagOverflow<Tag>(tags: readonly Tag[]) {
  return { shown: tags.slice(0, SHOWN_TAGS), hidden: tags.slice(SHOWN_TAGS) };
}
