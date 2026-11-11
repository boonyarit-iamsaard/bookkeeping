/**
 * The resource an operation addresses by id is not the owner's current one:
 * missing, deleted, another owner's, or its id is malformed. The cases are
 * indistinguishable on purpose, and no field is named because the address
 * itself is the input. An absent resource the request merely *refers to*
 * (a transaction's wallet, a category's parent) is a field-addressed
 * rejection instead.
 */
export interface NotFound {
  code: "not-found";
}

/** Reports the addressed resource as absent. */
export function notFound(): NotFound {
  return { code: "not-found" };
}

/** Whether an operation's error is the shared not-found, by its type. */
export function isNotFound(
  error: Readonly<{ code: string }>,
): error is NotFound {
  return error.code === "not-found";
}
