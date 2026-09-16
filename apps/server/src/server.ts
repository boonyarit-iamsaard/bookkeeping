import { serve } from "@hono/node-server";
import { createApp } from "./core/app.js";
import { parseServerEnv } from "./core/env/config.js";

const serverEnv = parseServerEnv(process.env);

serve(
  {
    fetch: createApp().fetch,
    port: serverEnv.port,
    hostname: serverEnv.hostname,
  },
  (info) => {
    console.log(`Server listening on http://${info.address}:${info.port}`);
  },
);
