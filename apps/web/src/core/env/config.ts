import * as z from "zod";

const httpUrlSchema = z.url({ protocol: /^https?$/ });

// Vite exposes only `VITE_`-prefixed variables to the browser bundle.
const clientEnvSchema = z.object({
  VITE_API_ORIGIN: httpUrlSchema,
});

export interface ClientConfig {
  /** The Hono API origin every credentialed request is sent to. */
  apiOrigin: string;
}

export function parseClientEnv(
  source: Readonly<Record<string, unknown>>,
): ClientConfig {
  const parsed = clientEnvSchema.parse(source);
  return { apiOrigin: new URL(parsed.VITE_API_ORIGIN).origin };
}

export const clientConfig = parseClientEnv(import.meta.env);
