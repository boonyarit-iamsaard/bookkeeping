import { describe, expect, it } from "vitest";

import { isScanProject } from "./stack";

describe("isScanProject", () => {
  it("owns the projects of one-off runs", () => {
    expect(isScanProject("bookkeeping-sonar-1a2b3c4d")).toBe(true);
  });

  it("leaves every other Compose project alone", () => {
    expect(isScanProject("bookkeeping")).toBe(false);
    expect(isScanProject("bookkeeping-sonar")).toBe(false);
    expect(isScanProject("bookkeeping-sonarqube")).toBe(false);
    expect(isScanProject("other-bookkeeping-sonar-1a2b3c4d")).toBe(false);
    expect(isScanProject("")).toBe(false);
  });
});
