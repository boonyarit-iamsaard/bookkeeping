import type { Rejected } from "../shared/rejection";

/**
 * The inputs a category command can refuse. A creation also refuses the
 * inputs of the parent it would create (`parentName`, `parentIconId`) and its
 * choice of parent (`parent`); an update carries only `name` and `iconId`.
 */
export type CategoryField =
  | "name"
  | "iconId"
  | "parentName"
  | "parentIconId"
  | "parent";

/** Every rule rejection a category command reports; each names the input it refuses. */
export type CategoryRejection =
  | { code: "blank-name"; field: "name" | "parentName" }
  | { code: "name-too-long"; field: "name" | "parentName" }
  | { code: "unknown-icon"; field: "iconId" | "parentIconId" }
  /** Same name, case-insensitively, already in scope (tree or parent). */
  | { code: "duplicate-name"; field: "name" | "parentName" }
  | { code: "parent-not-found"; field: "parent" }
  /** Trees have two levels: a child category cannot be a parent. */
  | { code: "parent-is-child"; field: "parent" }
  /** Uncategorized has no children. */
  | { code: "parent-protected"; field: "parent" }
  /** Uncategorized keeps its name; only its icon may change. */
  | { code: "protected"; field: "name" };

/** The refused inputs of a category command, in the shared envelope. */
export type CategoryRejected = Rejected<CategoryRejection>;
