import type { Auth } from "./config";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/** The authenticated context both app adapters derive every owner id from. */
export interface Session {
  id: string;
  expiresAt: Date;
  user: SessionUser;
}

/**
 * Resolves the session a request's cookies identify, or null when the request
 * carries no valid session. Callers never receive Better Auth's raw shape, so
 * the apps depend only on this contract.
 */
export async function resolveSession(
  auth: Auth,
  headers: Headers,
): Promise<Session | null> {
  const resolved = await auth.api.getSession({ headers });
  if (!resolved) {
    return null;
  }
  return {
    id: resolved.session.id,
    expiresAt: resolved.session.expiresAt,
    user: {
      id: resolved.user.id,
      email: resolved.user.email,
      name: resolved.user.name,
    },
  };
}
