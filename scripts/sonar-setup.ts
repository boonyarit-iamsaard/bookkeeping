import { randomBytes, randomUUID } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

import { z } from "zod";

const authenticationSchema = z.object({ valid: z.boolean() });
const projectsSchema = z.object({
  components: z.array(z.object({ key: z.string() })),
});
const tokenSchema = z.object({ token: z.string().min(1) });
const statusSchema = z.object({ status: z.string() });

interface RequestOptions {
  method?: string;
  body?: URLSearchParams;
  headers?: Readonly<Record<string, string>>;
}

const serverUrl = "http://localhost:9000";
const credentialsFile = new URL("../.env.sonar", import.meta.url);
const login = process.env.SONAR_ADMIN_LOGIN ?? "admin";
let password = process.env.SONAR_ADMIN_PASSWORD ?? "admin";

function authorization() {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

async function request(
  path: string,
  options: Readonly<RequestOptions> = {},
): Promise<unknown> {
  const response = await fetch(`${serverUrl}/api/${path}`, {
    ...options,
    headers: { authorization: authorization(), ...options.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`SonarQube ${path} failed (HTTP ${response.status}).`);
  }
  if (response.status === 204) {
    return undefined;
  }
  return response.json();
}

function post(path: string, parameters: Readonly<Record<string, string>>) {
  return request(path, {
    method: "POST",
    body: new URLSearchParams(parameters),
  });
}

async function saveCredentials(token = "") {
  const content = [
    `SONAR_ADMIN_LOGIN=${JSON.stringify(login)}`,
    `SONAR_ADMIN_PASSWORD=${JSON.stringify(password)}`,
    `SONAR_TOKEN=${JSON.stringify(token)}`,
    "",
  ].join("\n");
  await writeFile(credentialsFile, content, { mode: 0o600 });
  await chmod(credentialsFile, 0o600);
}

async function waitForServer() {
  console.log("Waiting for local SonarQube...");
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const response = await fetch(`${serverUrl}/api/system/status`, {
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
  throw new Error(
    "SonarQube is not ready. Check pnpm sonar:start and server logs.",
  );
}

async function setup() {
  await waitForServer();
  const authentication = authenticationSchema.parse(
    await request("authentication/validate"),
  );
  if (!authentication.valid) {
    throw new Error(
      "Admin credentials are invalid. Set SONAR_ADMIN_LOGIN and SONAR_ADMIN_PASSWORD to your existing credentials and rerun pnpm sonar:setup.",
    );
  }

  if (login === "admin" && password === "admin") {
    const newPassword = `Local_9aA_${randomBytes(24).toString("hex")}`;
    await post("users/change_password", {
      login,
      previousPassword: password,
      password: newPassword,
    });
    password = newPassword;
    await saveCredentials();
    console.log("Changed the default admin password; saved it in .env.sonar.");
  }

  const projects = projectsSchema.parse(
    await request("projects/search?projects=bookkeeping"),
  );
  if (projects.components.length === 0) {
    await post("projects/create", {
      project: "bookkeeping",
      name: "Bookkeeping",
      mainBranch: "main",
      visibility: "private",
    });
    console.log("Created the bookkeeping project.");
  }

  if (process.env.SONAR_TOKEN) {
    const authentication = authenticationSchema.parse(
      await request("authentication/validate", {
        headers: { authorization: `Bearer ${process.env.SONAR_TOKEN}` },
      }),
    );
    if (authentication.valid) {
      await saveCredentials(process.env.SONAR_TOKEN);
      console.log("Reused the existing token. Run pnpm sonar:scan.");
      return;
    }
  }

  const result = tokenSchema.parse(
    await post("user_tokens/generate", {
      name: `bookkeeping-local-${randomUUID()}`,
      type: "PROJECT_ANALYSIS_TOKEN",
      projectKey: "bookkeeping",
    }),
  );
  await saveCredentials(result.token);
  console.log(
    "Saved the project analysis token in .env.sonar. Run pnpm sonar:scan.",
  );
}

setup().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
