import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

import { z } from "zod";

const keyedSchema = z.looseObject({ key: z.string() });
const issueSchema = z.looseObject({
  key: z.string(),
  component: z.string(),
  message: z.string(),
  rule: z.string(),
  line: z.number().optional(),
  issueStatus: z.string().optional(),
  status: z.string().optional(),
  severity: z.string().optional(),
  type: z.string().optional(),
  effort: z.string().optional(),
  impacts: z
    .array(z.looseObject({ softwareQuality: z.string(), severity: z.string() }))
    .optional(),
  flows: z
    .array(
      z.looseObject({
        locations: z
          .array(
            z.looseObject({
              component: z.string().optional(),
              msg: z.string().optional(),
              textRange: z.looseObject({ startLine: z.number() }).optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});
const hotspotSchema = z.looseObject({
  key: z.string(),
  message: z.string(),
  status: z.string(),
  line: z.number().optional(),
  component: z
    .looseObject({ key: z.string(), path: z.string().optional() })
    .optional(),
  rule: z
    .looseObject({
      key: z.string(),
      vulnerabilityProbability: z.string().optional(),
    })
    .optional(),
});
const taskSchema = z.object({
  task: z.looseObject({
    id: z.string(),
    status: z.enum(["PENDING", "IN_PROGRESS", "SUCCESS", "FAILED", "CANCELED"]),
    analysisId: z.string().optional(),
    errorMessage: z.string().optional(),
  }),
});
const pageSchema = z.looseObject({
  paging: z.object({ total: z.number().int().nonnegative() }),
  components: z.array(keyedSchema).optional(),
  rules: z.array(keyedSchema).optional(),
});

interface PageOptions<T> {
  path: string;
  field: string;
  schema: z.ZodType<T>;
}

interface Report {
  projectKey: string;
  exportedAt: string;
  analysisId: string;
  taskId: string;
  dashboardUrl: string;
  issues: z.infer<typeof issueSchema>[];
  rules: z.infer<typeof keyedSchema>[];
  components: z.infer<typeof keyedSchema>[];
  hotspots: z.infer<typeof hotspotSchema>[];
}

const serverUrl = "http://localhost:9000";
const reportDirectory = new URL("../.sonar-reports/", import.meta.url);

async function request(path: string): Promise<unknown> {
  const login = process.env.SONAR_ADMIN_LOGIN;
  const password = process.env.SONAR_ADMIN_PASSWORD;
  if (!login || !password) {
    throw new Error("Missing export credentials. Run pnpm sonar:setup first.");
  }
  const response = await fetch(`${serverUrl}/api/${path}`, {
    headers: {
      authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`SonarQube ${path} failed (HTTP ${response.status}).`);
  }
  return response.json();
}

async function waitForAnalysis(taskId: string) {
  console.log("Waiting for SonarQube to process the submitted analysis...");
  for (let attempt = 0; attempt < 150; attempt++) {
    const { task } = taskSchema.parse(
      await request(`ce/task?id=${encodeURIComponent(taskId)}`),
    );
    if (task.status === "SUCCESS") {
      if (!task.analysisId) {
        throw new Error("Completed analysis is missing its ID.");
      }
      return { ...task, analysisId: task.analysisId };
    }
    if (task.status === "FAILED" || task.status === "CANCELED") {
      throw new Error(
        `Analysis processing ${task.status}: ${task.errorMessage ?? task.id}`,
      );
    }
    await setTimeout(2_000);
  }
  throw new Error(
    "Analysis processing timed out. Retry with pnpm sonar:export.",
  );
}

async function fetchPages<T>(options: Readonly<PageOptions<T>>) {
  const items: T[] = [];
  const components = new Map<string, z.infer<typeof keyedSchema>>();
  const rules = new Map<string, z.infer<typeof keyedSchema>>();
  for (let page = 1; ; page++) {
    const result = pageSchema.parse(
      await request(`${options.path}&ps=500&p=${page}`),
    );
    const batch = z.array(options.schema).parse(result[options.field]);
    items.push(...batch);
    for (const component of result.components ?? []) {
      components.set(component.key, component);
    }
    for (const rule of result.rules ?? []) {
      rules.set(rule.key, rule);
    }
    if (items.length >= result.paging.total) {
      return {
        items,
        components: [...components.values()],
        rules: [...rules.values()],
      };
    }
    if (batch.length === 0) {
      throw new Error("SonarQube returned an incomplete issue listing.");
    }
  }
}

function text(value: unknown) {
  return String(value ?? "")
    .replace(/[\\`*_{}[\]<>#|]/g, "\\$&")
    .replace(/\r?\n/g, " ");
}

function markdown(report: Readonly<Report>) {
  const lines = [
    "# Bookkeeping SonarQube report",
    "",
    `Exported: ${report.exportedAt}`,
    "",
    `Analysis: ${report.analysisId}`,
    "",
    `Issues: ${report.issues.length}. Security hotspots: ${report.hotspots.length}.`,
    "",
    "This snapshot includes all current project issues, including resolved issues. Security hotspots require review and are listed separately.",
    "",
    "## Issues",
    "",
  ];
  for (const issue of report.issues) {
    const file = issue.component.replace(/^bookkeeping:/, "");
    lines.push(
      `### ${text(file)}${issue.line ? `:${issue.line}` : ""}`,
      "",
      text(issue.message),
      "",
      `- Rule: ${text(issue.rule)}`,
      `- Status: ${text(issue.issueStatus ?? issue.status)}`,
      `- Severity: ${text(issue.severity ?? "See impacts")}`,
      `- Type: ${text(issue.type ?? "See impacts")}`,
      `- Effort: ${text(issue.effort ?? "Unspecified")}`,
      `- [View issue](${serverUrl}/project/issues?id=bookkeeping&issues=${encodeURIComponent(issue.key)})`,
    );
    for (const impact of issue.impacts ?? []) {
      lines.push(
        `- Impact: ${text(impact.softwareQuality)} / ${text(impact.severity)}`,
      );
    }
    for (const flow of issue.flows ?? []) {
      for (const location of flow.locations ?? []) {
        lines.push(
          `- Related location: ${text(location.component)}:${location.textRange?.startLine ?? "?"} — ${text(location.msg)}`,
        );
      }
    }
    lines.push("");
  }
  if (report.issues.length === 0) {
    lines.push("No issues found.", "");
  }
  lines.push("## Security hotspots", "");
  for (const hotspot of report.hotspots) {
    lines.push(
      `### ${text(hotspot.component?.path ?? hotspot.component?.key ?? hotspot.key)}:${hotspot.line ?? "?"}`,
      "",
      text(hotspot.message),
      "",
      `- Rule: ${text(hotspot.rule?.key)}`,
      `- Status: ${text(hotspot.status)}`,
      `- Review priority: ${text(hotspot.rule?.vulnerabilityProbability)}`,
      `- [View hotspot](${serverUrl}/security_hotspots?id=bookkeeping&hotspots=${encodeURIComponent(hotspot.key)})`,
      "",
    );
  }
  if (report.hotspots.length === 0) {
    lines.push("No security hotspots found.", "");
  }
  return lines.join("\n");
}

async function exportReport() {
  const metadata = await readFile(
    new URL("report-task.txt", reportDirectory),
    "utf8",
  );
  const taskId = metadata.match(/^ceTaskId=(.+)$/m)?.[1]?.trim();
  if (!taskId) {
    throw new Error("Missing scan task ID. Run pnpm sonar:scan first.");
  }
  const task = await waitForAnalysis(taskId);
  const issues = await fetchPages({
    path: "issues/search?components=bookkeeping&additionalFields=_all",
    field: "issues",
    schema: issueSchema,
  });
  const hotspots = await fetchPages({
    path: "hotspots/search?project=bookkeeping",
    field: "hotspots",
    schema: keyedSchema,
  });
  const hotspotDetails: z.infer<typeof hotspotSchema>[] = [];
  for (const hotspot of hotspots.items) {
    hotspotDetails.push(
      hotspotSchema.parse(
        await request(
          `hotspots/show?hotspot=${encodeURIComponent(hotspot.key)}`,
        ),
      ),
    );
  }
  const report: Report = {
    projectKey: "bookkeeping",
    exportedAt: new Date().toISOString(),
    analysisId: task.analysisId,
    taskId,
    dashboardUrl: `${serverUrl}/dashboard?id=bookkeeping`,
    issues: issues.items,
    rules: issues.rules,
    components: issues.components,
    hotspots: hotspotDetails,
  };
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(
    new URL("issues.json", reportDirectory),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writeFile(new URL("issues.md", reportDirectory), markdown(report));
  console.log(
    `Exported ${report.issues.length} issues and ${report.hotspots.length} security hotspots to .sonar-reports/issues.json and .sonar-reports/issues.md.`,
  );
}

exportReport().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
