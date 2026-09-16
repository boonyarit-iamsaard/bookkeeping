import * as z from "zod";

const httpUrlSchema = z.url({ protocol: /^https?$/ });

const originListSchema = z
  .string()
  .transform((value) => value.split(",").map((entry) => entry.trim()))
  .pipe(z.array(httpUrlSchema).min(1))
  .transform((urls) => urls.map((url) => new URL(url).origin));

const serverEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  HOST: z.string().min(1).default("0.0.0.0"),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: httpUrlSchema,
  CLIENT_ORIGINS: originListSchema,
});

export interface ServerEnv {
  port: number;
  hostname: string;
  databaseUrl: string;
  authSecret: string;
  /** The API origin this mount answers on; its session cookie is host-only. */
  authBaseUrl: string;
  /** Browser origins allowed to send credentialed requests. */
  clientOrigins: readonly string[];
}

export function parseServerEnv(
  source: Readonly<Record<string, string | undefined>>,
): ServerEnv {
  const parsed = serverEnvSchema.parse(source);
  return {
    port: parsed.PORT,
    hostname: parsed.HOST,
    databaseUrl: parsed.DATABASE_URL,
    authSecret: parsed.BETTER_AUTH_SECRET,
    authBaseUrl: parsed.BETTER_AUTH_URL,
    clientOrigins: parsed.CLIENT_ORIGINS,
  };
}
