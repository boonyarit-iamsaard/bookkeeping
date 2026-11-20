import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { exportCloudReport, parseReportScope } from "./cloud-report";
import type { SonarServer } from "./server";

const PROJECT = "owner_bookkeeping";
const reportSchema = z.object({
  issues: z.array(z.looseObject({ component: z.string() })),
});

interface FakeCloud {
  server: SonarServer;
  requests: string[];
}

/** Serves each request from the first canned response whose path prefix matches. */
function createFakeCloud(responses: Readonly<Record<string, unknown>>) {
  const requests: string[] = [];
  const fake: FakeCloud = {
    requests,
    server: {
      url: "https://sonarcloud.example",
      request(path) {
        requests.push(path);
        const match = Object.keys(responses).find((prefix) =>
          path.startsWith(prefix),
        );
        if (match === undefined) {
          return Promise.reject(new Error(`Unexpected request ${path}`));
        }
        return Promise.resolve(responses[match]);
      },
    },
  };
  return fake;
}

const analyzedPullRequest = {
  pullRequests: [
    {
      key: "7",
      analysisDate: "2026-11-20T12:59:22+0000",
      commit: { sha: "abc" },
    },
  ],
};
const analyzedMain = {
  branches: [
    {
      name: "main",
      analysisDate: "2026-11-20T13:03:11+0000",
      commit: { sha: "def" },
    },
  ],
};
const issue = {
  key: "issue-1",
  component: `${PROJECT}:apps/server/src/app.ts`,
  message: "Fix this",
  rule: "typescript:S1",
  line: 4,
  flows: [
    {
      locations: [
        {
          component: `${PROJECT}:apps/server/src/other.ts`,
          msg: "here",
          textRange: { startLine: 9 },
        },
      ],
    },
  ],
};
const noHotspots = { paging: { total: 0 }, hotspots: [] };

let directory: URL;

beforeEach(async () => {
  directory = pathToFileURL(
    `${await mkdtemp(join(tmpdir(), "sonar-report-"))}/`,
  );
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function readReport() {
  return {
    json: reportSchema.parse(
      JSON.parse(await readFile(new URL("issues.json", directory), "utf8")),
    ),
    markdown: await readFile(new URL("issues.md", directory), "utf8"),
  };
}

describe("parseReportScope", () => {
  it("reads a pull request", () => {
    expect(parseReportScope(["--pr", "7"])).toEqual({ pullRequest: "7" });
  });

  it("reads a branch and defaults to main", () => {
    expect(parseReportScope(["--branch", "next"])).toEqual({ branch: "next" });
    expect(parseReportScope([])).toEqual({ branch: "main" });
  });

  it("rejects both scopes at once", () => {
    expect(() => parseReportScope(["--pr", "7", "--branch", "main"])).toThrow(
      /either --pr or --branch/,
    );
  });
});

describe("exportCloudReport", () => {
  it("requests a pull request's unresolved issues and hotspots", async () => {
    const cloud = createFakeCloud({
      "project_pull_requests/list": analyzedPullRequest,
      "issues/search": { paging: { total: 0 }, issues: [] },
      "hotspots/search": noHotspots,
    });

    await exportCloudReport({
      server: cloud.server,
      projectKey: PROJECT,
      scope: { pullRequest: "7" },
      directory,
    });

    expect(cloud.requests).toEqual([
      `project_pull_requests/list?project=${PROJECT}`,
      `issues/search?componentKeys=${PROJECT}&pullRequest=7&resolved=false&additionalFields=_all&ps=500&p=1`,
      `hotspots/search?projectKey=${PROJECT}&pullRequest=7&status=TO_REVIEW&ps=500&p=1`,
    ]);
  });

  it("requests a branch's issues and hotspots", async () => {
    const cloud = createFakeCloud({
      "project_branches/list": analyzedMain,
      "issues/search": { paging: { total: 0 }, issues: [] },
      "hotspots/search": noHotspots,
    });

    await exportCloudReport({
      server: cloud.server,
      projectKey: PROJECT,
      scope: { branch: "main" },
      directory,
    });

    expect(cloud.requests).toEqual([
      `project_branches/list?project=${PROJECT}`,
      `issues/search?componentKeys=${PROJECT}&branch=main&resolved=false&additionalFields=_all&ps=500&p=1`,
      `hotspots/search?projectKey=${PROJECT}&branch=main&status=TO_REVIEW&ps=500&p=1`,
    ]);
  });

  it("stops paging at the reported total", async () => {
    const cloud = createFakeCloud({
      "project_branches/list": analyzedMain,
      "issues/search?componentKeys=owner_bookkeeping&branch=main&resolved=false&additionalFields=_all&ps=500&p=1":
        { paging: { total: 2 }, issues: [issue] },
      "issues/search": {
        paging: { total: 2 },
        issues: [{ ...issue, key: "issue-2" }],
      },
      "hotspots/search": noHotspots,
    });

    await exportCloudReport({
      server: cloud.server,
      projectKey: PROJECT,
      scope: { branch: "main" },
      directory,
    });

    expect(
      cloud.requests.filter((path) => path.startsWith("issues/search")),
    ).toHaveLength(2);
  });

  it("writes repository-relative paths that link to SonarQube Cloud", async () => {
    const cloud = createFakeCloud({
      "project_pull_requests/list": analyzedPullRequest,
      "issues/search": { paging: { total: 1 }, issues: [issue] },
      "hotspots/search": {
        paging: { total: 1 },
        hotspots: [{ key: "hotspot-1" }],
      },
      "hotspots/show": {
        key: "hotspot-1",
        message: "Review this",
        status: "TO_REVIEW",
        line: 2,
        component: { key: `${PROJECT}:infra/x.yaml`, path: "infra/x.yaml" },
        rule: { key: "s:1", vulnerabilityProbability: "LOW" },
      },
    });

    await exportCloudReport({
      server: cloud.server,
      projectKey: PROJECT,
      scope: { pullRequest: "7" },
      directory,
    });

    const { json, markdown } = await readReport();
    expect(json.issues[0]?.component).toBe("apps/server/src/app.ts");
    expect(markdown).toContain("### apps/server/src/app.ts:4");
    expect(markdown).toContain(
      "- Related location: apps/server/src/other.ts:9",
    );
    expect(markdown).toContain(
      `(https://sonarcloud.example/project/issues?id=${PROJECT}&pullRequest=7&issues=issue-1)`,
    );
    expect(markdown).toContain(
      `(https://sonarcloud.example/project/security_hotspots?id=${PROJECT}&pullRequest=7&hotspots=hotspot-1)`,
    );
  });

  it("fails clearly when the scope has no analysis", async () => {
    const cloud = createFakeCloud({
      "project_pull_requests/list": { pullRequests: [] },
    });

    await expect(
      exportCloudReport({
        server: cloud.server,
        projectKey: PROJECT,
        scope: { pullRequest: "8" },
        directory,
      }),
    ).rejects.toThrow("SonarQube Cloud has no analysis of pull request 8");
    expect(cloud.requests).toHaveLength(1);
  });
});
