import { createAuth } from "@bookkeeping/auth/config";
import { createDatabase } from "@bookkeeping/database/connection";
import { serve } from "@hono/node-server";
import { createApp } from "./core/app.js";
import { API_COOKIE_PREFIX, createAuthGateway } from "./core/auth/auth.js";
import { parseServerEnv } from "./core/env/config.js";

const serverEnv = parseServerEnv(process.env);
const { db } = createDatabase(serverEnv.databaseUrl);
const auth = createAuth({
  db,
  secret: serverEnv.authSecret,
  baseURL: serverEnv.authBaseUrl,
  trustedOrigins: serverEnv.clientOrigins,
  cookiePrefix: API_COOKIE_PREFIX,
});
const app = createApp({
  auth: createAuthGateway(auth),
  db,
  clientOrigins: serverEnv.clientOrigins,
});

serve(
  {
    fetch: app.fetch,
    port: serverEnv.port,
    hostname: serverEnv.hostname,
  },
  (info) => {
    console.log(`Server listening on http://${info.address}:${info.port}`);
  },
);
