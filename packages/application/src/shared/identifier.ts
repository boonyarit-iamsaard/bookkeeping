const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PostgreSQL rejects a malformed uuid as a query fault, so operations check
 * the shape first: such an id simply names no resource.
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
