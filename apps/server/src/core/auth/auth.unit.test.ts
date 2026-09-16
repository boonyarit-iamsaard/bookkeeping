import { describe, expect, it } from "vitest";
import {
  anonymousAuthGateway,
  createTestApp,
} from "../../testing/create-test-app.js";

describe("managed auth routes", () => {
  it("delegates every method under /api/auth to the auth mount", async () => {
    const seen: string[] = [];
    const app = createTestApp({
      ...anonymousAuthGateway,
      async handleRequest(request) {
        seen.push(`${request.method} ${new URL(request.url).pathname}`);
        return Response.json({ ok: true });
      },
    });

    const getResponse = await app.request("/api/auth/get-session");
    const postResponse = await app.request("/api/auth/sign-in/email", {
      method: "POST",
    });

    expect(getResponse.status).toBe(200);
    expect(postResponse.status).toBe(200);
    expect(seen).toEqual([
      "GET /api/auth/get-session",
      "POST /api/auth/sign-in/email",
    ]);
    expect(getResponse.headers.get("X-Request-Id")).toBeTruthy();
  });
});
