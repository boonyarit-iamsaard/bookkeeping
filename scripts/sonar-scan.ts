import { parseArgs } from "node:util";

import { formatError, scriptArguments } from "./sonar/arguments";
import { exportReport } from "./sonar/report";
import { provisionServer } from "./sonar/server";
import {
  createScanProject,
  printServerDiagnostics,
  removeAllScanProjects,
  removeScannerImages,
  removeScanProject,
  runScanner,
  startScanStack,
} from "./sonar/stack";

interface ScanFlags {
  keep: boolean;
  purgeImages: boolean;
}

function parseScanFlags(): ScanFlags {
  const { values } = parseArgs({
    args: scriptArguments(),
    options: {
      // Leave the server running to browse the dashboard; the next scan or
      // `pnpm sonar:clean` removes it.
      keep: { type: "boolean", default: false },
      // Also remove the SonarQube and scanner images, which the next scan
      // pulls again.
      "purge-images": { type: "boolean", default: false },
    },
  });
  return { keep: values.keep, purgeImages: values["purge-images"] };
}

async function scan() {
  const flags = parseScanFlags();
  // A killed run, or one kept with --keep, leaves its stack behind until the
  // next run starts. Scans are exclusive, so this also stops a concurrent one.
  removeAllScanProjects();
  const project = createScanProject();
  let kept = false;
  let removed = false;
  // Never throws, so a failed removal cannot hide the scan's own error or
  // turn an interrupt into a crash.
  function removeStack() {
    if (kept || removed) {
      return;
    }
    removed = true;
    console.log("Removing the SonarQube containers, volumes, and network...");
    try {
      removeScanProject(project);
      if (flags.purgeImages) {
        removeScannerImages();
      }
    } catch (error) {
      console.error(
        `Clean-up failed: ${formatError(error)}. Run pnpm sonar:clean to retry.`,
      );
    }
  }
  for (const [signal, exitCode] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const) {
    process.once(signal, () => {
      removeStack();
      process.exit(exitCode);
    });
  }
  try {
    const stack = startScanStack(project);
    const { server, password, token } = await provisionServer(stack.serverUrl);
    const taskId = await runScanner(stack, token);
    await exportReport({ server, taskId, linkDashboard: flags.keep });
    if (flags.keep) {
      kept = true;
      console.log(
        `SonarQube stays up at ${stack.serverUrl}; sign in as admin with ${password}. Run pnpm sonar:clean to remove it.`,
      );
    }
  } catch (error) {
    printServerDiagnostics(project);
    throw error;
  } finally {
    removeStack();
  }
}

scan().catch((error: unknown) => {
  console.error(`Scan failed: ${formatError(error)}`);
  process.exitCode = 1;
});
