import { parseArgs } from "node:util";

import { formatError, scriptArguments } from "./sonar/arguments";
import { removeAllScanProjects, removeScannerImages } from "./sonar/stack";

try {
  const { values: flags } = parseArgs({
    args: scriptArguments(),
    options: { "purge-images": { type: "boolean", default: false } },
  });
  const removed = removeAllScanProjects();
  console.log(
    `Removed ${removed} SonarQube containers, volumes, and networks.`,
  );
  if (flags["purge-images"]) {
    removeScannerImages();
  }
} catch (error) {
  console.error(`Clean-up failed: ${formatError(error)}`);
  process.exitCode = 1;
}
