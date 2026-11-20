import { formatError, scriptArguments } from "./sonar/arguments";
import {
  CLOUD_PROJECT_KEY,
  CLOUD_URL,
  exportCloudReport,
  parseReportScope,
} from "./sonar/cloud-report";
import { createSonarServer } from "./sonar/server";

exportCloudReport({
  server: createSonarServer(CLOUD_URL),
  projectKey: CLOUD_PROJECT_KEY,
  scope: parseReportScope(scriptArguments()),
}).catch((error: unknown) => {
  console.error(`Report failed: ${formatError(error)}`);
  process.exitCode = 1;
});
