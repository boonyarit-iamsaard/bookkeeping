import { useCategoryCatalog } from "./use-category-catalog";

/**
 * Each category's color, from the categories list read. A screen showing
 * colored rows awaits that read in its loader, so rows never render
 * uncolored.
 */
export function useCategoryColors() {
  return useCategoryCatalog().colorOf;
}
