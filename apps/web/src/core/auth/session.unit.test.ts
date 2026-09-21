import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { authClient } from "@/core/auth/client";
import {
  readSession,
  resetSessionCache,
  sessionQuery,
} from "@/core/auth/session";

vi.mock("@/core/auth/client", () => ({
  authClient: { getSession: vi.fn() },
}));

const getSession = vi.mocked(authClient.getSession);

function createSignedInResponse() {
  return {
    data: {
      user: { id: "user-1", email: "owner@test.local" },
      session: { id: "session-1" },
    },
  };
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  getSession.mockReset();
});

describe("readSession", () => {
  test("resolves the signed-in session and answers later reads from the cache", async () => {
    getSession.mockResolvedValue(createSignedInResponse());
    const queryClient = createQueryClient();

    const first = await readSession(queryClient);
    const second = await readSession(queryClient);

    expect(first?.user.email).toBe("owner@test.local");
    expect(second).toBe(first);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  test("resolves null when nobody is signed in", async () => {
    getSession.mockResolvedValue({ data: null });
    const queryClient = createQueryClient();

    await expect(readSession(queryClient)).resolves.toBeNull();
  });

  test("rejects when the session could not be read", async () => {
    getSession.mockResolvedValue({
      error: { status: 503, statusText: "Service Unavailable" },
    });
    const queryClient = createQueryClient();

    await expect(readSession(queryClient)).rejects.toThrow(
      "Service Unavailable",
    );
  });
});

describe("resetSessionCache", () => {
  test("drops the cached session and every other cached read", async () => {
    getSession
      .mockResolvedValueOnce(createSignedInResponse())
      .mockResolvedValueOnce({ data: null });
    const queryClient = createQueryClient();
    queryClient.setQueryData(["/v1/wallets", {}], []);
    await readSession(queryClient);

    resetSessionCache(queryClient);

    expect(queryClient.getQueryData(["/v1/wallets", {}])).toBeUndefined();
    expect(queryClient.getQueryData(sessionQuery().queryKey)).toBeUndefined();
    await expect(readSession(queryClient)).resolves.toBeNull();
    expect(getSession).toHaveBeenCalledTimes(2);
  });
});
