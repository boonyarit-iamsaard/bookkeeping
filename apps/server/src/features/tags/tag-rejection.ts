import type {
  TagField,
  TagRejected,
  TagRejection,
} from "@bookkeeping/application/tags";
import {
  defineCodeTable,
  toFieldErrors,
} from "../../core/http/field-rejections.js";

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

/** The field errors of a refused create or rename, pointing into the request document. */
export function toTagFieldErrors(rejected: Readonly<TagRejected>) {
  return toFieldErrors(rejected, {
    pointers: TAG_FIELD_POINTERS,
    codes: tagCodes,
  });
}
