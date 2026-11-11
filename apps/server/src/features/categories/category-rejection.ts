import type {
  CategoryField,
  CategoryRejection,
} from "@bookkeeping/application/categories";
import { defineCodeTable } from "../../core/http/field-rejections.js";

/**
 * Where each refused input lives in a create or update request document. An
 * update carries only `name` and `iconId`; a creation also nests its new
 * parent's inputs under `parent.create`.
 */
export const CATEGORY_FIELD_POINTERS: Readonly<Record<CategoryField, string>> =
  {
    name: "#/name",
    iconId: "#/iconId",
    parentName: "#/parent/create/name",
    parentIconId: "#/parent/create/iconId",
    parent: "#/parent",
  };

/** Every category rule code is published as is: no message names a fact. */
export const categoryCodes = defineCodeTable<CategoryRejection>("Category", {
  "blank-name": "plain",
  "name-too-long": "plain",
  "unknown-icon": "plain",
  "duplicate-name": "plain",
  "parent-not-found": "plain",
  "parent-is-child": "plain",
  "parent-protected": "plain",
  protected: "plain",
});

export const categoryRejectionProblemSchema = categoryCodes.problemSchema;
