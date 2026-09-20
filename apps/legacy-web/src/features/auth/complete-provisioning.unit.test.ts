import { afterEach, describe, expect, test, vi } from "vitest";
import { completeProvisioning } from "@/features/auth/complete-provisioning";
import { retryProvisioningAction } from "@/features/auth/server/provisioning.actions";

vi.mock("@/features/auth/server/provisioning.actions", () => ({
  retryProvisioningAction: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("completeProvisioning", () => {
  test("reports an expected retry failure without blocking navigation", async () => {
    const reported = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.mocked(retryProvisioningAction).mockResolvedValue({
      ok: false,
      error: { code: "unauthenticated" },
    });

    await expect(completeProvisioning()).resolves.toBeUndefined();

    expect(reported).toHaveBeenCalledWith(
      "Fresh-user provisioning retry failed",
      { error: { code: "unauthenticated" } },
    );
  });

  test("reports an unexpected retry fault without blocking navigation", async () => {
    const fault = new Error("database unavailable");
    const reported = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.mocked(retryProvisioningAction).mockRejectedValue(fault);

    await expect(completeProvisioning()).resolves.toBeUndefined();

    expect(reported).toHaveBeenCalledWith(
      "Fresh-user provisioning retry failed",
      { error: fault },
    );
  });
});
