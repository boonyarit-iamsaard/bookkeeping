import { useSuspenseQuery } from "@tanstack/react-query";
import { tagQueries } from "@/core/api/queries";

/** The owner's tags in suggestion order: most recent and most used first. */
export function useTagCatalog() {
  const { data } = useSuspenseQuery(tagQueries.list());
  if (!data) {
    throw new Error("The tag catalog returned no data");
  }
  return data.items;
}
