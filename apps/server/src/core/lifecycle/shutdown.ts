import type { ServerType } from "@hono/node-server";

const IDLE_CONNECTION_SWEEP_MS = 100;

export interface ShutdownResources {
  server: ServerType;
  closeDatabase: () => Promise<void>;
}

function closeServer(server: ServerType): Promise<void> {
  return new Promise((resolve, reject) => {
    // close() drops idle keep-alive connections only once. A connection whose
    // response finishes afterwards stays open until its keep-alive timeout,
    // holding shutdown, so keep dropping idle connections until it completes.
    const idleSweep =
      "closeIdleConnections" in server
        ? setInterval(
            () => server.closeIdleConnections(),
            IDLE_CONNECTION_SWEEP_MS,
          )
        : undefined;
    server.close((error) => {
      clearInterval(idleSweep);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Stops accepting connections, lets in-flight requests finish, then releases
 * the database pool.
 */
export async function shutDown({
  server,
  closeDatabase,
}: Readonly<ShutdownResources>): Promise<void> {
  await closeServer(server);
  await closeDatabase();
}
