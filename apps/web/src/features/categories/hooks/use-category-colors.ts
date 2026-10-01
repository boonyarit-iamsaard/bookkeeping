import { useSuspenseQuery } from "@tanstack/react-query";
import { categoryQueries } from "@/core/api/queries";
import { createCategoryColors } from "@/features/categories/category-color";

/**
 * Each category's color, from the categories list read. A screen showing
 * colored rows awaits that read in its loader, so rows never render
 * uncolored.
 */
export function useCategoryColors() {
  const { data } = useSuspenseQuery(categoryQueries.list());
  return createCategoryColors(data?.items ?? []);
}
