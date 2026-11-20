import { parseArgs } from "node:util";

import { z } from "zod";

import { writeReport } from "./report";
import type { SonarServer } from "./server";

export const CLOUD_URL = "https://sonarcloud.io";
export const CLOUD_PROJECT_KEY = "boonyarit-iamsaard_bookkeeping";

export type ReportScope = { pullRequest: string } | { branch: string };

const analyzedSchema = z.looseObject({
  analysisDate: z.string().optional(),
  commit: z.looseObject({ sha: z.string() }).optional(),
});
const pullRequestsSchema = z.looseObject({
  pullRequests: z.array(analyzedSchema.extend({ key: z.string() })),
});
const branchesSchema = z.looseObject({
  branches: z.array(analyzedSchema.extend({ name: z.string() })),
});

/** Reads `--pr <number>` or `--branch <name>`, defaulting to `main`. */
export function parseReportScope(args: readonly string[]): ReportScope {
  const { values } = parseArgs({
    args: [...args],
    options: { pr: { type: "string" }, branch: { type: "string" } },
  });
  if (values.pr !== undefined && values.branch !== undefined) {
    throw new Error("Pass either --pr or --branch, not both.");
  }
  return values.pr === undefined
    ? { branch: values.branch ?? "main" }
    : { pullRequest: values.pr };
}

function describeScope(scope: Readonly<ReportScope>) {
  return "pullRequest" in scope
    ? `pull request ${scope.pullRequest}`
    : `branch ${scope.branch}`;
}

export interface CloudReportOptions {
  server: SonarServer;
  projectKey: string;
  scope: ReportScope;
  /** Defaults to `.sonar-reports/`. */
  directory?: URL;
}

// project_analyses ignores pullRequest, so the scope's own listing proves an analysis exists.
async function findAnalysis({
  server,
  projectKey,
  scope,
}: Readonly<CloudReportOptions>) {
  const project = encodeURIComponent(projectKey);
  const analyzed =
    "pullRequest" in scope
      ? pullRequestsSchema
          .parse(
            await server.request(
              `project_pull_requests/list?project=${project}`,
            ),
          )
          .pullRequests.find(({ key }) => key === scope.pullRequest)
      : branchesSchema
          .parse(
            await server.request(`project_branches/list?project=${project}`),
          )
          .branches.find(({ name }) => name === scope.branch);
  if (analyzed?.analysisDate === undefined) {
    throw new Error(
      `SonarQube Cloud has no analysis of ${describeScope(scope)} yet; wait for its SonarQube Cloud check to finish.`,
    );
  }
  return {
    scope: describeScope(scope),
    analysisDate: analyzed.analysisDate,
    ...(analyzed.commit ? { revision: analyzed.commit.sha } : {}),
  };
}

/** Writes the open issues and hotspots of one analyzed branch or pull request. */
export async function exportCloudReport({
  server,
  projectKey,
  scope,
  directory,
}: Readonly<CloudReportOptions>): Promise<void> {
  const analysis = await findAnalysis({ server, projectKey, scope });
  const project = encodeURIComponent(projectKey);
  const scopeQuery = new URLSearchParams({ ...scope }).toString();
  const pages = { issue: "issues", hotspot: "security_hotspots" };
  const param = { issue: "issues", hotspot: "hotspots" };
  await writeReport({
    server,
    projectKey,
    issuesPath: `issues/search?componentKeys=${project}&${scopeQuery}&resolved=false&additionalFields=_all`,
    hotspotsPath: `hotspots/search?projectKey=${project}&${scopeQuery}&status=TO_REVIEW`,
    analysis,
    dashboardUrl: `${server.url}/dashboard?id=${project}&${scopeQuery}`,
    linkTo: ({ kind, key }) =>
      `${server.url}/project/${pages[kind]}?id=${project}&${scopeQuery}&${param[kind]}=${encodeURIComponent(key)}`,
    ...(directory === undefined ? {} : { directory }),
  });
}
