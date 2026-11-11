import { useSuspenseQuery } from "@tanstack/react-query";
import { tagQueries } from "@/core/api/queries";

/** The owner's tags in suggestion order: most recent and most used first. */
export function useTagCatalog() {
  const { data } = useSuspenseQuery(tagQueries.list());
  return data.items;
}
