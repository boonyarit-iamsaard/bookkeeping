import { cors } from "hono/cors";
import { REQUEST_ID_HEADER } from "./request-context.js";

/**
 * Credentialed CORS for the configured client origins only. Browser clients
 * read the request identifier and created-resource location from responses.
 */
export function corsMiddleware(clientOrigins: readonly string[]) {
  return cors({
    origin: [...clientOrigins],
    credentials: true,
    allowHeaders: ["Content-Type", "Idempotency-Key"],
    exposeHeaders: [REQUEST_ID_HEADER, "Location"],
  });
}
