import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { readSignUp } from "@/core/auth/sign-up";

const { getSignUp } = vi.hoisted(() => ({
  getSignUp: vi.fn(),
}));

vi.mock("@/core/api/client", () => ({
  apiClient: { GET: getSignUp },
}));

beforeEach(() => {
  getSignUp.mockReset();
});

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("readSignUp", () => {
  test("resolves open and answers later reads from the cache", async () => {
    getSignUp.mockResolvedValue({
      data: { signUp: "open" },
      response: new Response(null, { status: 200 }),
    });
    const queryClient = createQueryClient();

    const first = await readSignUp(queryClient);
    const second = await readSignUp(queryClient);

    expect(first).toBe("open");
    expect(second).toBe(first);
    expect(getSignUp).toHaveBeenCalledTimes(1);
  });

  test("resolves closed when the API says Sign-up is closed", async () => {
    getSignUp.mockResolvedValue({
      data: { signUp: "closed" },
      response: new Response(null, { status: 200 }),
    });

    await expect(readSignUp(createQueryClient())).resolves.toBe("closed");
  });

  test("resolves closed when the request is rejected", async () => {
    getSignUp.mockRejectedValue(new Error("network unavailable"));

    await expect(readSignUp(createQueryClient())).resolves.toBe("closed");
  });

  test("resolves closed when the API answers unsuccessfully", async () => {
    getSignUp.mockResolvedValue({
      error: { status: 503 },
      response: new Response(null, { status: 503 }),
    });

    await expect(readSignUp(createQueryClient())).resolves.toBe("closed");
  });

  test("resolves closed when the API body is malformed", async () => {
    getSignUp.mockResolvedValue({
      data: { signUp: "unexpected" },
      response: new Response(null, { status: 200 }),
    });

    await expect(readSignUp(createQueryClient())).resolves.toBe("closed");
  });
});
