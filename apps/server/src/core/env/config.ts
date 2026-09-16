import * as z from "zod";

const serverEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  HOST: z.string().min(1).default("0.0.0.0"),
});

export interface ServerEnv {
  port: number;
  hostname: string;
}

export function parseServerEnv(
  source: Readonly<Record<string, string | undefined>>,
): ServerEnv {
  const parsed = serverEnvSchema.parse(source);
  return { port: parsed.PORT, hostname: parsed.HOST };
}
