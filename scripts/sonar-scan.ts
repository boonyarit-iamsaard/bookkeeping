import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";

const containerName = `bookkeeping-sonar-scan-${randomUUID()}`;
const reportDirectory = ".sonar-reports";

try {
  mkdirSync(reportDirectory, { recursive: true });
  try {
    execFileSync(
      "docker",
      [
        "compose",
        "--env-file",
        ".env.sonar",
        "-f",
        "docker-compose.sonar.yaml",
        "run",
        "--name",
        containerName,
        "--no-deps",
        "scanner",
      ],
      { stdio: "inherit" },
    );
    execFileSync("docker", [
      "cp",
      `${containerName}:/tmp/scannerwork/report-task.txt`,
      `${reportDirectory}/report-task.txt`,
    ]);
  } finally {
    execFileSync("docker", ["rm", "-f", containerName], { stdio: "ignore" });
  }
  execFileSync(
    process.execPath,
    ["--import", "tsx", "scripts/sonar-export.ts"],
    {
      stdio: "inherit",
    },
  );
} catch (error) {
  console.error(
    `Scan or export failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
