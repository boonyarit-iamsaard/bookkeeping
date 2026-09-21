import { afterEach, describe, expect, test, vi } from "vitest";
import { apiClient } from "@/core/api/client";
import { completeProvisioning } from "@/features/auth/complete-provisioning";

vi.mock("@/core/api/client", () => ({
  apiClient: { POST: vi.fn() },
}));

const post = vi.mocked(apiClient.POST);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("completeProvisioning", () => {
  test("calls the defaults endpoint and resolves quietly on success", async () => {
    post.mockResolvedValue({
      data: { seededKinds: ["expense"] },
      response: new Response(null, { status: 200 }),
    });

    await expect(completeProvisioning()).resolves.toBeUndefined();

    expect(post).toHaveBeenCalledWith("/v1/categories/defaults");
  });

  test("reports an expected retry failure without blocking navigation", async () => {
    const reported = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const problem = {
      status: 401,
      code: "unauthenticated",
      title: "Authentication required",
    };
    post.mockResolvedValue({
      error: problem,
      response: new Response(null, { status: 401 }),
    });

    await expect(completeProvisioning()).resolves.toBeUndefined();

    expect(reported).toHaveBeenCalledWith(
      "Fresh-user provisioning retry failed",
      { error: problem },
    );
  });

  test("reports an unexpected retry fault without blocking navigation", async () => {
    const fault = new TypeError("Failed to fetch");
    const reported = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    post.mockRejectedValue(fault);

    await expect(completeProvisioning()).resolves.toBeUndefined();

    expect(reported).toHaveBeenCalledWith(
      "Fresh-user provisioning retry failed",
      { error: fault },
    );
  });
});
