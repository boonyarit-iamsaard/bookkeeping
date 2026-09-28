import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { z } from "zod";

const PROJECT_KEY = "bookkeeping";
const DEFAULT_LOGIN = "admin";
const DEFAULT_PASSWORD = "admin";

const statusSchema = z.object({ status: z.string() });
const tokenSchema = z.object({ token: z.string().min(1) });

interface RequestOptions {
  method?: "POST";
  body?: URLSearchParams;
}

export interface SonarServer {
  url: string;
  request: (
    path: string,
    options?: Readonly<RequestOptions>,
  ) => Promise<unknown>;
}

function createSonarServer(url: string, password: string): SonarServer {
  const authorization = `Basic ${Buffer.from(`${DEFAULT_LOGIN}:${password}`).toString("base64")}`;
  return {
    url,
    async request(path, options = {}) {
      const response = await fetch(`${url}/api/${path}`, {
        ...options,
        headers: { authorization },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(`SonarQube ${path} failed (HTTP ${response.status}).`);
      }
      return response.status === 204 ? undefined : response.json();
    },
  };
}

async function waitForServer(url: string): Promise<void> {
  console.log("Waiting for SonarQube to start...");
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      const response = await fetch(`${url}/api/system/status`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (
        response.ok &&
        statusSchema.parse(await response.json()).status === "UP"
      ) {
        return;
      }
    } catch {
      // The web process may not be listening during startup.
    }
    await setTimeout(2_000);
  }
  throw new Error("SonarQube did not start within five minutes.");
}

export interface ProvisionedServer {
  server: SonarServer;
  /** The generated admin password, for signing in to a kept dashboard. */
  password: string;
  /** A project analysis token for the scanner. */
  token: string;
}

/**
 * Waits for a fresh server, replaces its default admin password, and creates
 * the project with an analysis token. Nothing is saved, because the server
 * is removed after the scan.
 */
export async function provisionServer(url: string): Promise<ProvisionedServer> {
  await waitForServer(url);
  const password = `Local_9aA_${randomBytes(24).toString("hex")}`;
  await createSonarServer(url, DEFAULT_PASSWORD).request(
    "users/change_password",
    {
      method: "POST",
      body: new URLSearchParams({
        login: DEFAULT_LOGIN,
        previousPassword: DEFAULT_PASSWORD,
        password,
      }),
    },
  );
  const server = createSonarServer(url, password);
  await server.request("projects/create", {
    method: "POST",
    body: new URLSearchParams({
      project: PROJECT_KEY,
      name: "Bookkeeping",
      mainBranch: "main",
      visibility: "private",
    }),
  });
  const { token } = tokenSchema.parse(
    await server.request("user_tokens/generate", {
      method: "POST",
      body: new URLSearchParams({
        name: `bookkeeping-scan-${randomUUID()}`,
        type: "PROJECT_ANALYSIS_TOKEN",
        projectKey: PROJECT_KEY,
      }),
    }),
  );
  return { server, password, token };
}
