import type { CategorySummary } from "@bookkeeping/domain/categories";

export interface CreateCategoryOutcome {
  category: CategorySummary;
  createdParent?: CategorySummary;
}

export interface UpdatedCategoryOutcome {
  operation: "update";
  category: CategorySummary;
}

export interface RemovedCategoryOutcome {
  operation: "remove";
  reassigned: number;
}

export type ManageCategoryOutcome =
  | UpdatedCategoryOutcome
  | RemovedCategoryOutcome;
