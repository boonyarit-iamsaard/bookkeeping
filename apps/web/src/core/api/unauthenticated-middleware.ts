import type { Middleware } from "openapi-fetch";

export interface UnauthenticatedMiddlewareOptions {
  /** Runs when the API answers a request with 401: the cookie no longer holds. */
  onUnauthenticated: () => void;
}

/**
 * The real session check: every API call is authenticated by the cookie, and
 * the moment one is refused the app forgets what it cached and returns to
 * sign-in. The response itself still reaches the caller as a problem.
 */
export function createUnauthenticatedMiddleware({
  onUnauthenticated,
}: Readonly<UnauthenticatedMiddlewareOptions>): Middleware {
  return {
    onResponse({ response }) {
      if (response.status === 401) {
        onUnauthenticated();
      }
    },
  };
}
