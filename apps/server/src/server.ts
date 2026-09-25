import { createAuth } from "@bookkeeping/auth/config";
import { createDatabase } from "@bookkeeping/database/connection";
import { serve } from "@hono/node-server";
import { createApp } from "./core/app.js";
import { API_COOKIE_PREFIX, createAuthGateway } from "./core/auth/gateway.js";
import { parseServerEnv } from "./core/env/config.js";

const serverConfig = parseServerEnv(process.env);
const { db } = createDatabase(serverConfig.databaseUrl);
const auth = createAuth({
  db,
  secret: serverConfig.authSecret,
  baseURL: serverConfig.authBaseUrl,
  trustedOrigins: serverConfig.clientOrigins,
  cookiePrefix: API_COOKIE_PREFIX,
  rateLimitEnabled: serverConfig.authRateLimitEnabled,
  signUpEnabled: serverConfig.authSignUpEnabled,
});
const app = createApp({
  auth: createAuthGateway(auth),
  db,
  clientOrigins: serverConfig.clientOrigins,
});

serve(
  {
    fetch: app.fetch,
    port: serverConfig.port,
    hostname: serverConfig.hostname,
  },
  (info) => {
    console.log(`Server listening on http://${info.address}:${info.port}`);
  },
);
