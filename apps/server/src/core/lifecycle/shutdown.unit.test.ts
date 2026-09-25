import type { AddressInfo } from "node:net";
import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { shutDown } from "./shutdown.js";

interface RunningServer {
  server: ServerType;
  origin: string;
}

const runningServers = new Set<ServerType>();

function startServer(app: Hono): Promise<RunningServer> {
  return new Promise((resolve) => {
    const server = serve(
      { fetch: app.fetch, port: 0, hostname: "127.0.0.1" },
      (info: AddressInfo) => {
        resolve({ server, origin: `http://127.0.0.1:${info.port}` });
      },
    );
    runningServers.add(server);
  });
}

afterEach(async () => {
  await Promise.all(
    [...runningServers].map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  runningServers.clear();
});

describe("shutDown", () => {
  it("lets an in-flight request finish before closing the database", async () => {
    const events: string[] = [];
    let releaseRequest = () => {};
    let markRequestStarted = () => {};
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve;
    });
    const app = new Hono().get("/slow", async (context) => {
      markRequestStarted();
      await new Promise<void>((resolve) => {
        releaseRequest = resolve;
      });
      events.push("request finished");
      return context.text("done");
    });
    const { server, origin } = await startServer(app);

    const response = fetch(`${origin}/slow`);
    await requestStarted;
    const shutdown = shutDown({
      server,
      closeDatabase: async () => {
        events.push("database closed");
      },
    });
    releaseRequest();

    expect(await (await response).text()).toBe("done");
    await shutdown;
    expect(events).toEqual(["request finished", "database closed"]);
  }, 1000);

  it("refuses new connections once it starts", async () => {
    const app = new Hono().get("/health", (context) => context.text("ok"));
    const { server, origin } = await startServer(app);

    await shutDown({ server, closeDatabase: async () => {} });

    await expect(fetch(`${origin}/health`)).rejects.toThrow();
  });

  it("does not wait for idle keep-alive connections", async () => {
    const app = new Hono().get("/health", (context) => context.text("ok"));
    const { server, origin } = await startServer(app);
    const response = await fetch(`${origin}/health`, {
      headers: { connection: "keep-alive" },
    });
    await response.text();

    await expect(
      shutDown({ server, closeDatabase: async () => {} }),
    ).resolves.toBeUndefined();
  });
});
