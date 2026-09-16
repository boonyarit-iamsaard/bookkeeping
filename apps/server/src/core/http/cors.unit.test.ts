import { describe, expect, it } from "vitest";
import {
  createTestApp,
  TEST_CLIENT_ORIGIN,
} from "../testing/create-test-app.js";

describe("credentialed CORS", () => {
  it("answers preflight for a configured client origin", async () => {
    const response = await createTestApp().request("/v1/wallets", {
      method: "OPTIONS",
      headers: {
        origin: TEST_CLIENT_ORIGIN,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,idempotency-key",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      TEST_CLIENT_ORIGIN,
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "Content-Type,Idempotency-Key",
    );
    expect(response.headers.get("access-control-allow-methods")).toContain(
      "POST",
    );
  });

  it("exposes the request identifier and location headers to clients", async () => {
    const response = await createTestApp().request("/health", {
      headers: { origin: TEST_CLIENT_ORIGIN },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe(
      TEST_CLIENT_ORIGIN,
    );
    expect(response.headers.get("access-control-expose-headers")).toBe(
      "X-Request-Id,Location",
    );
    expect(response.headers.get("vary")).toContain("Origin");
  });

  it("does not allow an unconfigured origin", async () => {
    const response = await createTestApp().request("/health", {
      headers: { origin: "https://evil.example" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});
