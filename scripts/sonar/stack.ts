import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { sonarScannerArguments } from "./scanner-arguments";

const PROJECT_PREFIX = "bookkeeping-sonar";
const PROJECT_LABEL = "com.docker.compose.project";
// Resolved from this file, so the scan works from any working directory.
const COMPOSE_FILE = fileURLToPath(
  new URL("../../docker-compose.sonar.yaml", import.meta.url),
);
const REPOSITORY = fileURLToPath(new URL("../..", import.meta.url));
const SERVER_IMAGE = "sonarqube:community";

type ResourceKind = "container" | "volume" | "network";

interface Resource {
  id: string;
  project: string;
}

/** A Compose project one scan run created: `bookkeeping-sonar-<id>`. */
export function isScanProject(project: string): boolean {
  return project.startsWith(`${PROJECT_PREFIX}-`);
}

function docker(args: readonly string[]): string {
  return execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function composeArgs(project: string, args: readonly string[]): string[] {
  return ["compose", "-f", COMPOSE_FILE, "-p", project, ...args];
}

function compose(project: string, args: readonly string[]): string {
  return docker(composeArgs(project, args));
}

function listResources(kind: ResourceKind): Resource[] {
  const list = kind === "container" ? ["ps", "-a"] : [kind, "ls"];
  const id = kind === "volume" ? "{{.Name}}" : "{{.ID}}";
  const output = docker([
    ...list,
    "--filter",
    `label=${PROJECT_LABEL}`,
    "--format",
    `${id}\t{{.Label "${PROJECT_LABEL}"}}`,
  ]);
  return output
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const [resourceId = "", project = ""] = line.split("\t");
      return { id: resourceId, project };
    });
}

/**
 * Removes every container, volume, and network of the matching Compose
 * projects, including the anonymous volumes SonarQube's image declares.
 */
function removeProjects(matches: (project: string) => boolean): number {
  let removed = 0;
  const steps: [ResourceKind, string[]][] = [
    ["container", ["rm", "--force", "--volumes"]],
    ["volume", ["volume", "rm", "--force"]],
    ["network", ["network", "rm"]],
  ];
  for (const [kind, command] of steps) {
    const ids = listResources(kind)
      .filter((resource) => matches(resource.project))
      .map((resource) => resource.id);
    if (ids.length > 0) {
      docker([...command, ...ids]);
      removed += ids.length;
    }
  }
  return removed;
}

/** Removes what earlier runs left behind, including a running scan's stack. */
export function removeAllScanProjects(): number {
  return removeProjects(isScanProject);
}

export function removeScanProject(project: string): number {
  return removeProjects((name) => name === project);
}

export function removeServerImage(): void {
  try {
    docker(["image", "rm", SERVER_IMAGE]);
  } catch {
    // The image was never pulled or another container still uses it.
  }
}

export interface ScanStack {
  project: string;
  serverUrl: string;
}

/** A fresh Compose project name for one run. */
export function createScanProject(): string {
  return `${PROJECT_PREFIX}-${randomUUID().slice(0, 8)}`;
}

export function startScanStack(project: string): ScanStack {
  compose(project, ["up", "--detach", "sonarqube"]);
  const address = compose(project, ["port", "sonarqube", "9000"]);
  return { project, serverUrl: `http://${address}` };
}

/**
 * Prints why the server may have failed: its container state, including an
 * out-of-memory kill, and the end of its log.
 */
export function printServerDiagnostics(project: string): void {
  try {
    const container = compose(project, ["ps", "--all", "--quiet", "sonarqube"]);
    console.error(
      `SonarQube container state: ${docker([
        "inspect",
        "--format",
        "{{.State.Status}} exit={{.State.ExitCode}} oomKilled={{.State.OOMKilled}}",
        container,
      ])}`,
    );
    console.error(compose(project, ["logs", "--tail", "40", "sonarqube"]));
  } catch {
    // The container never started, so there is nothing to report.
  }
}

/**
 * Runs the npm-distributed scanner natively, with the JRE it provisions from
 * the server, and returns the scan's server-side task ID. A scanner container
 * would read the repository through a bind mount, which stalls on native
 * Windows. It runs asynchronously so the event loop keeps servicing signals
 * and notices the server closing idle connections during the minutes a scan
 * takes.
 */
export async function runScanner(
  stack: Readonly<ScanStack>,
  token: string,
): Promise<string> {
  const scannerBin = createRequire(import.meta.url).resolve(
    "@sonar/scan/bin/sonar-scanner.js",
  );
  const scanner = spawn(
    process.execPath,
    [
      scannerBin,
      ...sonarScannerArguments({
        serverUrl: stack.serverUrl,
        repository: REPOSITORY,
      }),
    ],
    { env: { ...process.env, SONAR_TOKEN: token }, stdio: "inherit" },
  );
  const [exitCode] = await once(scanner, "exit");
  if (exitCode !== 0) {
    throw new Error(`The scanner exited with ${exitCode}.`);
  }
  const report = await readFile(
    join(REPOSITORY, ".scannerwork", "report-task.txt"),
    "utf8",
  );
  const taskId = /^ceTaskId=(.+)$/m.exec(report)?.[1]?.trim();
  if (!taskId) {
    throw new Error("The scanner did not report a task ID.");
  }
  return taskId;
}
