export const UNIQUE_VIOLATION = "23505";
export const FOREIGN_KEY_VIOLATION = "23503";
export const RESTRICT_VIOLATION = "23001";

export interface DatabaseError {
  /** The PostgreSQL SQLSTATE, such as `23505` for a unique violation. */
  code: string;
  constraint: string | undefined;
}

/** Drizzle wraps driver errors; the PostgreSQL detail is on `cause`. */
export function databaseError(error: unknown): DatabaseError | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const candidate: unknown = error.cause instanceof Error ? error.cause : error;
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !("code" in candidate) ||
    typeof candidate.code !== "string"
  ) {
    return undefined;
  }
  const constraint =
    "constraint" in candidate && typeof candidate.constraint === "string"
      ? candidate.constraint
      : undefined;
  return { code: candidate.code, constraint };
}
