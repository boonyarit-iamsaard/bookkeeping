import { describe, expect, it } from "vitest";
import { sonarScannerArguments } from "./scanner-arguments";

describe("sonarScannerArguments", () => {
  it("scans the repository into the local server's project", () => {
    expect(
      sonarScannerArguments({
        serverUrl: "http://127.0.0.1:55001",
        repository: "C:\\Users\\someone\\bookkeeping",
      }),
    ).toEqual([
      "-Dsonar.host.url=http://127.0.0.1:55001",
      "-Dsonar.projectBaseDir=C:\\Users\\someone\\bookkeeping",
      "-Dsonar.projectKey=bookkeeping",
    ]);
  });
});
