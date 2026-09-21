import { describe, expect, test, vi } from "vitest";
import type { ApiResponse } from "./problem";
import type { WriteAttempt } from "./write-submission";
import { createWriteSubmission } from "./write-submission";

interface Wallet {
  id: string;
}

const PROBLEM_MEDIA_TYPE = "application/problem+json";

function accepted(wallet: Wallet): ApiResponse<Wallet> {
  return { data: wallet, response: new Response(null, { status: 201 }) };
}

function rejected(status: number, problem: object): ApiResponse<Wallet> {
  return {
    error: problem,
    response: new Response(null, {
      status,
      headers: { "content-type": PROBLEM_MEDIA_TYPE },
    }),
  };
}

const invalidCommand = {
  type: "urn:bookkeeping:problem:invalid-command",
  title: "Command is invalid",
  status: 422,
  code: "invalid-command",
};

function keySequence(...keys: string[]) {
  const remaining = [...keys];
  return () => {
    const key = remaining.shift();
    if (key === undefined) {
      throw new Error("No key left for this attempt");
    }
    return key;
  };
}

describe("createWriteSubmission", () => {
  test("sends a client-generated key with the request", async () => {
    const send = vi.fn(async () => accepted({ id: "w1" }));
    const submission = createWriteSubmission<{ name: string }, Wallet>({
      generateKey: keySequence("key-1"),
    });

    const result = await submission.submit({ name: "Cash" }, { send });

    expect(result).toEqual({ ok: true, value: { id: "w1" } });
    expect(send).toHaveBeenCalledWith({ name: "Cash" }, {
      header: { "idempotency-key": "key-1" },
    } satisfies WriteAttempt);
  });

  test("replays the same key once when the response is lost", async () => {
    const send = vi
      .fn<
        (input: unknown, attempt: WriteAttempt) => Promise<ApiResponse<Wallet>>
      >()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(accepted({ id: "w1" }));
    const submission = createWriteSubmission<unknown, Wallet>({
      generateKey: keySequence("key-1", "key-2"),
    });

    const result = await submission.submit({}, { send });

    expect(result).toEqual({ ok: true, value: { id: "w1" } });
    expect(
      send.mock.calls.map(([, attempt]) => attempt.header["idempotency-key"]),
    ).toEqual(["key-1", "key-1"]);
  });

  test("gives up after one replay and rethrows the loss", async () => {
    const send = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const submission = createWriteSubmission<unknown, Wallet>({
      generateKey: keySequence("key-1"),
    });

    await expect(submission.submit({}, { send })).rejects.toThrow(
      "Failed to fetch",
    );
    expect(send).toHaveBeenCalledTimes(2);
  });

  test("does not replay a failure that is not a network error", async () => {
    const send = vi.fn(async () => {
      throw new RangeError("Malformed request");
    });
    const submission = createWriteSubmission<unknown, Wallet>({
      generateKey: keySequence("key-1"),
    });

    await expect(submission.submit({}, { send })).rejects.toThrow(
      "Malformed request",
    );
    expect(send).toHaveBeenCalledTimes(1);
  });

  test("uses a fresh key for the next submit", async () => {
    const send = vi.fn(async (_input: unknown, _attempt: WriteAttempt) =>
      accepted({ id: "w1" }),
    );
    const submission = createWriteSubmission<unknown, Wallet>({
      generateKey: keySequence("key-1", "key-2"),
    });

    await submission.submit({}, { send });
    await submission.submit({}, { send });

    expect(
      send.mock.calls.map(([, attempt]) => attempt.header["idempotency-key"]),
    ).toEqual(["key-1", "key-2"]);
  });

  test("ignores a second submit while one is in flight", async () => {
    let release: (response: ApiResponse<Wallet>) => void = () => {};
    const send = vi.fn(
      () =>
        new Promise<ApiResponse<Wallet>>((resolve) => {
          release = resolve;
        }),
    );
    const submission = createWriteSubmission<{ name: string }, Wallet>({
      generateKey: keySequence("key-1", "key-2"),
    });

    const first = submission.submit({ name: "first" }, { send });
    const second = submission.submit({ name: "second" }, { send });
    release(accepted({ id: "w1" }));

    expect(await second).toEqual(await first);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      { name: "first" },
      { header: { "idempotency-key": "key-1" } },
    );
  });

  test("maps a 422 problem's field errors by request field name", async () => {
    const send = vi.fn(async () =>
      rejected(422, {
        ...invalidCommand,
        errors: [
          { pointer: "#/name", code: "blank-name" },
          { pointer: "#/openingAmount/value", code: "invalid-format" },
          { pointer: "#/openingAmount/currency", code: "invalid-value" },
        ],
      }),
    );
    const submission = createWriteSubmission<unknown, Wallet>({
      generateKey: keySequence("key-1"),
    });

    const result = await submission.submit(
      {},
      {
        send,
        describeFieldError: ({ field, code }) => `${field}: ${code}`,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        status: 422,
        message: undefined,
        fieldErrors: {
          name: "name: blank-name",
          openingAmount: "openingAmount: invalid-format",
        },
      },
    });
  });

  test("describes a field error by its detail when no describer is given", async () => {
    const send = vi.fn(async () =>
      rejected(422, {
        ...invalidCommand,
        errors: [
          { pointer: "#/name", code: "duplicate-name", detail: "Taken" },
        ],
      }),
    );
    const submission = createWriteSubmission<unknown, Wallet>({
      generateKey: keySequence("key-1"),
    });

    const result = await submission.submit({}, { send });

    expect(result).toMatchObject({
      ok: false,
      error: { fieldErrors: { name: "Taken" } },
    });
  });

  test("turns a problem without field errors into a message", async () => {
    const send = vi.fn(async () =>
      rejected(409, {
        type: "urn:bookkeeping:problem:idempotency-conflict",
        title: "Idempotency-Key reused with a different payload",
        status: 409,
        code: "idempotency-conflict",
      }),
    );
    const submission = createWriteSubmission<unknown, Wallet>({
      generateKey: keySequence("key-1"),
    });

    const result = await submission.submit({}, { send });

    expect(result).toEqual({
      ok: false,
      error: {
        status: 409,
        problem: expect.objectContaining({ code: "idempotency-conflict" }),
        errors: [],
        fieldErrors: {},
        message: "Idempotency-Key reused with a different payload",
      },
    });
  });

  test("prefers the problem's detail as the message", async () => {
    const send = vi.fn(async () =>
      rejected(422, { ...invalidCommand, detail: "Nothing to change" }),
    );
    const submission = createWriteSubmission<unknown, Wallet>({
      generateKey: keySequence("key-1"),
    });

    const result = await submission.submit({}, { send });

    expect(result).toMatchObject({
      ok: false,
      error: { message: "Nothing to change", fieldErrors: {} },
    });
  });

  test("stands in for a failure body that is not a problem document", async () => {
    const send = vi.fn(
      async (): Promise<ApiResponse<Wallet>> => ({
        error: "<html>",
        response: new Response(null, {
          status: 502,
          statusText: "Bad Gateway",
        }),
      }),
    );
    const submission = createWriteSubmission<unknown, Wallet>({
      generateKey: keySequence("key-1"),
    });

    const result = await submission.submit({}, { send });

    expect(result).toMatchObject({
      ok: false,
      error: { status: 502, message: "Bad Gateway" },
    });
  });
});
