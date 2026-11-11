import type { TagField, TagRejection } from "@bookkeeping/application/tags";
import { defineCodeTable } from "../../core/http/field-rejections.js";

/** Where each refused input lives in a create or rename request document. */
export const TAG_FIELD_POINTERS: Readonly<Record<TagField, string>> = {
  name: "#/name",
};

/** Every tag rule code is published as is: no message names a fact. */
export const tagCodes = defineCodeTable<TagRejection>("Tag", {
  "blank-name": "plain",
  "name-too-long": "plain",
  "duplicate-name": "plain",
});

export const tagRejectionProblemSchema = tagCodes.problemSchema;
