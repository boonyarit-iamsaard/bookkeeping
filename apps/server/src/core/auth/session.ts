import type { Session } from "@bookkeeping/auth/session";
import { createMiddleware } from "hono/factory";
import {
  createProblemResponse,
  getProblemOptionsForStatus,
} from "../http/problem-details.js";
import type { RequestContextVariables } from "../http/request-context.js";
import type { AuthGateway } from "./gateway.js";

export interface AuthenticatedVariables extends RequestContextVariables {
  session: Session;
}

/** Routes behind `requireSession` read the resolved session from context. */
export interface AuthenticatedEnv {
  // biome-ignore lint/style/useNamingConvention: Hono requires this contract property to be named Variables.
  Variables: AuthenticatedVariables;
}

export function requireSession(auth: AuthGateway) {
  return createMiddleware<AuthenticatedEnv>(async (c, next) => {
    const session = await auth.resolveSession(c.req.raw.headers);
    if (session === null) {
      return createProblemResponse(c, getProblemOptionsForStatus(401));
    }
    c.set("session", session);
    await next();
  });
}
