/** A list that always holds at least one item. */
export type NonEmpty<Item> = readonly [Item, ...Item[]];

/**
 * One refused input: the rule's stable `code`, the `field` the rule author
 * chose as at fault, and any facts the code's message names. The field union
 * is the feature's own; the edge turns it into a pointer.
 */
export interface FieldRejection<Field extends string = string> {
  code: string;
  field: Field;
}

/**
 * Every input an operation refused, in one shape for every feature. An
 * operation that rejects one input at a time still answers a one-item list.
 */
export interface Rejected<Rejection extends FieldRejection = FieldRejection> {
  code: "rejected";
  rejections: NonEmpty<Rejection>;
}

/** Reports the refused inputs, at least one. */
export function rejected<Rejection extends FieldRejection>(
  ...rejections: NonEmpty<Rejection>
): Rejected<Rejection> {
  return { code: "rejected", rejections };
}

/**
 * Reports the refused inputs collected by a validator, or `undefined` when it
 * collected none.
 */
export function rejectedOrNone<Rejection extends FieldRejection>(
  rejections: readonly Rejection[],
): Rejected<Rejection> | undefined {
  const [first, ...rest] = rejections;
  return first === undefined ? undefined : rejected(first, ...rest);
}
