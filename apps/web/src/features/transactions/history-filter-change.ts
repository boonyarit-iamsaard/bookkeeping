import type {
  HistoryFilterKey,
  HistoryFilterValues,
} from "@/features/transactions/history-schema";

/** The filters with one control's value replaced; an empty value lifts that filter. */
export function changeHistoryFilter(
  values: Readonly<HistoryFilterValues>,
  { key, value }: Readonly<{ key: HistoryFilterKey; value: string }>,
): HistoryFilterValues {
  const { [key]: _previous, ...rest } = values;
  return value === "" ? rest : { ...rest, [key]: value };
}

/** The filters with one tag chosen or, if it already was, let go; no tags lifts the filter. */
export function toggleHistoryTag(
  values: Readonly<HistoryFilterValues>,
  tagId: string,
): HistoryFilterValues {
  const { tagId: chosen = [], ...rest } = values;
  const tagIds = chosen.includes(tagId)
    ? chosen.filter((id) => id !== tagId)
    : [...chosen, tagId];
  return tagIds.length > 0 ? { ...rest, tagId: tagIds } : rest;
}
