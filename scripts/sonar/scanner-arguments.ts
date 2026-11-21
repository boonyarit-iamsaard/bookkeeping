import { LOCAL_PROJECT_KEY } from "./server";

interface ScannerRun {
  serverUrl: string;
  repository: string;
}

/**
 * The `@sonar/scan` arguments that analyze `repository` on the local server.
 * The token goes through `SONAR_TOKEN`, so it stays out of the process list.
 */
export function sonarScannerArguments({
  serverUrl,
  repository,
}: Readonly<ScannerRun>): string[] {
  return [
    `-Dsonar.host.url=${serverUrl}`,
    `-Dsonar.projectBaseDir=${repository}`,
    `-Dsonar.projectKey=${LOCAL_PROJECT_KEY}`,
  ];
}
