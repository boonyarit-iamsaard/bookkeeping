import { describe, expect, it } from "vitest";
import { createTestApp } from "../../testing/create-test-app.js";

describe("health routes", () => {
  it("serves a successful health response in-process", async () => {
    const response = await createTestApp().request("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
