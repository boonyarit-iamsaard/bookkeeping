import { createAuthClient } from "better-auth/react";
import { clientConfig } from "@/core/env/config";

/**
 * Better Auth's browser client against the Hono mount. The session cookie is
 * host-only on the API origin, so every call carries credentials.
 */
export const authClient = createAuthClient({
  baseURL: clientConfig.apiOrigin,
  fetchOptions: { credentials: "include" },
});

export type Session = typeof authClient.$Infer.Session;
