import { useSuspenseQuery } from "@tanstack/react-query";
import { categoryQueries } from "@/core/api/queries";
import { createCategoryColors } from "../category-color";

/** One live cached catalog for paths, choices, type defaults, and inherited hues. */
export function useCategoryCatalog() {
  const { data } = useSuspenseQuery(categoryQueries.list());
  return { categories: data.items, colorOf: createCategoryColors(data.items) };
}
