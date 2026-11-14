import { describe, expect, it } from "vitest";
import { shellcheckDockerArguments } from "./shellcheck-arguments";

describe("shellcheckDockerArguments", () => {
  it("mounts the repository read-only without a network and lints each file", () => {
    expect(
      shellcheckDockerArguments({
        repository: "C:\\Users\\someone\\bookkeeping",
        files: ["apps/backup/backup.sh", "apps/backup/restore.sh"],
      }),
    ).toEqual([
      "run",
      "--rm",
      "--network",
      "none",
      "--volume",
      "C:\\Users\\someone\\bookkeeping:/mnt:ro",
      "--workdir",
      "/mnt",
      "koalaman/shellcheck:v0.11.0@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d",
      "apps/backup/backup.sh",
      "apps/backup/restore.sh",
    ]);
  });

  it("returns nothing to run when no shell script is tracked", () => {
    expect(
      shellcheckDockerArguments({ repository: "/repo", files: [] }),
    ).toBeNull();
  });
});
