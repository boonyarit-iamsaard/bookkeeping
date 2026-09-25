import { createAuth } from "@bookkeeping/auth/config";
import { createDatabase } from "@bookkeeping/database/connection";
import { serve } from "@hono/node-server";
import { createApp } from "./core/app.js";
import { API_COOKIE_PREFIX, createAuthGateway } from "./core/auth/gateway.js";
import { parseServerEnv } from "./core/env/config.js";
import { shutDown } from "./core/lifecycle/shutdown.js";

const serverConfig = parseServerEnv(process.env);
const { db, close: closeDatabase } = createDatabase(serverConfig.databaseUrl);
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

const server = serve(
  {
    fetch: app.fetch,
    port: serverConfig.port,
    hostname: serverConfig.hostname,
  },
  (info) => {
    console.log(`Server listening on http://${info.address}:${info.port}`);
  },
);

function handleShutdownSignal(signal: NodeJS.Signals) {
  // Shut down once. A second signal gets Node's default and exits at once,
  // rather than closing the server and the pool again mid-drain.
  process.off("SIGTERM", handleShutdownSignal);
  process.off("SIGINT", handleShutdownSignal);
  console.log(`Received ${signal}; finishing in-flight requests`);
  shutDown({ server, closeDatabase }).then(
    () => process.exit(0),
    (error: unknown) => {
      console.error("Shutdown failed", error);
      process.exit(1);
    },
  );
}

process.on("SIGTERM", handleShutdownSignal);
process.on("SIGINT", handleShutdownSignal);
