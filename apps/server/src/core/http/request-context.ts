import { randomUUID } from "node:crypto";
import type { Context, Next } from "hono";

export const REQUEST_ID_HEADER = "X-Request-Id";

export interface RequestContextVariables {
  requestId: string;
}

export interface ServerAppEnv {
  // biome-ignore lint/style/useNamingConvention: Hono requires this contract property to be named Variables.
  Variables: RequestContextVariables;
}

export async function requestContextMiddleware(
  c: Context<ServerAppEnv>,
  next: Next,
): Promise<void> {
  const requestId = randomUUID();
  c.set("requestId", requestId);

  try {
    await next();
  } finally {
    c.header(REQUEST_ID_HEADER, requestId);
  }
}
