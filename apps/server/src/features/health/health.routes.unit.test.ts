import { describe, expect, it } from "vitest";
import { createUnitTestApp } from "../../testing/create-unit-test-app.js";

describe("health routes", () => {
  it("serves a successful health response in-process", async () => {
    const response = await createUnitTestApp().request("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
