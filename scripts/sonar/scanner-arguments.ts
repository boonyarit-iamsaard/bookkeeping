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
    // The local server names its project `bookkeeping`, not the Cloud key in
    // sonar-project.properties.
    "-Dsonar.projectKey=bookkeeping",
  ];
}
