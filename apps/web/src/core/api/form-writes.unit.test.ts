import { describe, expect, test, vi } from "vitest";
import { createFormWrites } from "./form-writes";
import type { ApiResponse } from "./problem";
import type { ApiRejection, WriteAttempt } from "./write-submission";

interface Tag {
  id: string;
  name: string;
}

interface TagName {
  name: string;
}

const PROBLEM_MEDIA_TYPE = "application/problem+json";

function accepted<Output>(value: Output): ApiResponse<Output> {
  return { data: value, response: new Response(null, { status: 200 }) };
}

function rejected(status: number, problem: object): ApiResponse<never> {
  return {
    error: problem,
    response: new Response(null, {
      status,
      headers: { "content-type": PROBLEM_MEDIA_TYPE },
    }),
  };
}

const tagNotFound = {
  type: "urn:bookkeeping:problem:not-found",
  title: "Tag not found",
  status: 404,
  code: "not-found",
};

const invalidCommand = {
  type: "urn:bookkeeping:problem:invalid-command",
  title: "Command is invalid",
  status: 422,
  code: "invalid-command",
};

const refundsExist = {
  type: "urn:bookkeeping:problem:refunds-exist",
  title: "Expense has refunds",
  status: 409,
  code: "refunds-exist",
};

/** Records the order the collaborators were reached in. */
function createJournal() {
  const entries: string[] = [];
  return {
    entries,
    refresh: vi.fn(async (retired: readonly (readonly unknown[])[]) => {
      entries.push(`refresh ${JSON.stringify(retired)}`);
    }),
    forget: vi.fn((retired: readonly (readonly unknown[])[]) => {
      entries.push(`forget ${JSON.stringify(retired)}`);
    }),
    note(entry: string) {
      entries.push(entry);
    },
  };
}

describe("createFormWrites", () => {
  test("a successful write refreshes, then finishes, then forgets retired reads", async () => {
    const journal = createJournal();
    const writes = createFormWrites({
      fields: [],
      refresh: journal.refresh,
      forget: journal.forget,
      writes: () => ({
        remove: {
          kind: "delete",
          send: async () => accepted(undefined),
          retired: [["/v1/tags/{tagId}", "t1"]],
          onDone: async () => journal.note("done"),
        },
      }),
    });

    await writes.submit.remove();

    expect(journal.entries).toEqual([
      'refresh [["/v1/tags/{tagId}","t1"]]',
      "done",
      'forget [["/v1/tags/{tagId}","t1"]]',
    ]);
  });

  test("the success step receives the representation", async () => {
    const journal = createJournal();
    const onDone = vi.fn();
    const writes = createFormWrites({
      fields: ["name"],
      refresh: journal.refresh,
      forget: journal.forget,
      writes: () => ({
        rename: {
          kind: "change",
          send: async (input: TagName) => accepted({ id: "t2", ...input }),
          onDone,
        },
      }),
    });

    await writes.submit.rename({ name: "Food" });

    expect(onDone).toHaveBeenCalledWith({ id: "t2", name: "Food" });
    expect(journal.forget).not.toHaveBeenCalled();
    expect(writes.state()).toMatchObject({
      pending: false,
      serverError: undefined,
      fieldErrors: {},
    });
  });

  test("a deletion answered not found is done", async () => {
    const journal = createJournal();
    const writes = createFormWrites({
      fields: [],
      refresh: journal.refresh,
      forget: journal.forget,
      writes: () => ({
        remove: {
          kind: "delete",
          send: async () => rejected(404, tagNotFound),
          describeRejection: () => "This tag no longer exists.",
          onDone: async () => journal.note("done"),
        },
      }),
    });

    await writes.submit.remove();

    expect(journal.entries).toEqual(["refresh []", "done"]);
    expect(writes.state().serverError).toBeUndefined();
  });

  test("a change answered not found fails with the feature's message", async () => {
    const journal = createJournal();
    const onDone = vi.fn();
    const writes = createFormWrites({
      fields: ["name"],
      refresh: journal.refresh,
      forget: journal.forget,
      writes: () => ({
        rename: {
          kind: "change",
          send: async (_input: TagName) => rejected(404, tagNotFound),
          describeRejection: () => "This tag no longer exists.",
          onDone,
        },
      }),
    });

    await writes.submit.rename({ name: "Food" });

    expect(writes.state().serverError).toBe("This tag no longer exists.");
    expect(onDone).not.toHaveBeenCalled();
    expect(journal.refresh).not.toHaveBeenCalled();
  });

  test.each([
    {
      kind: "create",
      message:
        "The change could not be confirmed. Your values are kept; check your connection and try again.",
    },
    {
      kind: "change",
      message:
        "The change could not be confirmed. Your values are kept; check your connection and try again.",
    },
    {
      kind: "delete",
      message:
        "The deletion could not be confirmed. Check your connection and try again; deleting twice is harmless.",
    },
  ] as const)(
    "a $kind whose response is lost twice says so",
    async ({ kind, message }) => {
      const journal = createJournal();
      const onDone = vi.fn();
      const send = vi.fn(async (_input: TagName) => {
        throw new TypeError("Failed to fetch");
      });
      const writes = createFormWrites({
        fields: ["name"],
        refresh: journal.refresh,
        forget: journal.forget,
        writes: () => ({ save: { kind, send, onDone } }),
      });

      await writes.submit.save({ name: "Food" });

      expect(send).toHaveBeenCalledTimes(2);
      expect(writes.state()).toMatchObject({
        pending: false,
        serverError: message,
        fieldErrors: {},
      });
      expect(onDone).not.toHaveBeenCalled();
      expect(journal.refresh).not.toHaveBeenCalled();
    },
  );

  test("places field errors by the form's fields and an unclaimed one in the error bar", async () => {
    const journal = createJournal();
    const writes = createFormWrites({
      fields: ["name"],
      refresh: journal.refresh,
      forget: journal.forget,
      writes: () => ({
        create: {
          kind: "create",
          send: async (_input: TagName) =>
            rejected(422, {
              ...invalidCommand,
              errors: [
                { pointer: "#/name", code: "duplicate-name" },
                { pointer: "#/", code: "unrecognized-keys" },
              ],
            }),
          describeFieldError: ({ code }) => `Described ${code}`,
          onDone: vi.fn(),
        },
      }),
    });

    await writes.submit.create({ name: "Food" });

    expect(writes.state()).toMatchObject({
      serverError: "Described unrecognized-keys",
      fieldErrors: { name: "Described duplicate-name" },
    });
    expect(journal.refresh).not.toHaveBeenCalled();
  });

  test("a rejection reads as the feature describes it", async () => {
    const journal = createJournal();
    const writes = createFormWrites({
      fields: [],
      refresh: journal.refresh,
      forget: journal.forget,
      writes: () => ({
        remove: {
          kind: "delete",
          send: async () => rejected(409, refundsExist),
          describeRejection: (rejection) =>
            `Blocked by ${rejection.problem.code}`,
          onDone: vi.fn(),
        },
      }),
    });

    await writes.submit.remove();

    expect(writes.state().serverError).toBe("Blocked by refunds-exist");
  });

  test("a rejection re-reads the screen only when the feature asks", async () => {
    const journal = createJournal();
    const refreshOnRejection = vi.fn(
      (rejection: Readonly<ApiRejection>) =>
        rejection.problem.code === "refunds-exist",
    );
    const responses = [
      rejected(409, refundsExist),
      rejected(422, { ...invalidCommand, detail: "Nothing to change" }),
    ];
    const writes = createFormWrites({
      fields: [],
      refresh: journal.refresh,
      forget: journal.forget,
      writes: () => ({
        save: {
          kind: "change",
          send: async () => responses.shift() ?? accepted(undefined),
          refreshOnRejection,
          onDone: vi.fn(),
        },
      }),
    });

    await writes.submit.save();
    await writes.submit.save();

    expect(journal.entries).toEqual(["refresh []"]);
    expect(writes.state().serverError).toBe("Nothing to change");
  });

  test("starting any write clears what another write left", async () => {
    const journal = createJournal();
    const writes = createFormWrites({
      fields: ["name"],
      refresh: journal.refresh,
      forget: journal.forget,
      writes: () => ({
        rename: {
          kind: "change",
          send: async (_input: TagName) =>
            rejected(422, {
              ...invalidCommand,
              errors: [{ pointer: "#/name", code: "blank-name" }],
              detail: "Check the name",
            }),
          onDone: vi.fn(),
        },
        remove: {
          kind: "delete",
          send: async () => rejected(409, refundsExist),
          onDone: vi.fn(),
        },
      }),
    });

    await writes.submit.rename({ name: "" });
    expect(writes.state().fieldErrors).toEqual({
      name: "This value was not accepted.",
    });

    await writes.submit.remove();

    expect(writes.state()).toMatchObject({
      serverError: "Expense has refunds",
      fieldErrors: {},
    });
  });

  test("editing a field clears only that field's error", async () => {
    const journal = createJournal();
    const writes = createFormWrites({
      fields: ["name", "color"],
      refresh: journal.refresh,
      forget: journal.forget,
      writes: () => ({
        save: {
          kind: "change",
          send: async () =>
            rejected(422, {
              ...invalidCommand,
              errors: [
                { pointer: "#/name", code: "blank-name", detail: "Name it" },
                { pointer: "#/color", code: "invalid", detail: "Pick one" },
              ],
            }),
          onDone: vi.fn(),
        },
      }),
    });

    await writes.submit.save();
    writes.clearFieldError("name");

    expect(writes.state().fieldErrors).toEqual({ color: "Pick one" });
  });

  test("only a creation sends an idempotency key", async () => {
    const journal = createJournal();
    const attempts: unknown[][] = [];
    function record(...args: unknown[]) {
      attempts.push(args.slice(1));
      return Promise.resolve(accepted(undefined));
    }
    const writes = createFormWrites({
      fields: [],
      refresh: journal.refresh,
      forget: journal.forget,
      writes: () => ({
        create: {
          kind: "create",
          send: (input: TagName, attempt: Readonly<WriteAttempt>) =>
            record(input, attempt),
          onDone: vi.fn(),
        },
        change: {
          kind: "change",
          send: (input: TagName) => record(input),
          onDone: vi.fn(),
        },
        remove: { kind: "delete", send: () => record(), onDone: vi.fn() },
      }),
    });

    await writes.submit.create({ name: "Food" });
    await writes.submit.change({ name: "Food" });
    await writes.submit.remove();

    expect(attempts).toEqual([
      [{ header: { "idempotency-key": expect.any(String) } }],
      [],
      [],
    ]);
  });

  test("is pending from submit to outcome, and a second submit joins the first", async () => {
    const journal = createJournal();
    const onDone = vi.fn();
    const states: boolean[] = [];
    let release: (response: ApiResponse<Tag>) => void = () => {};
    const send = vi.fn(
      (_input: TagName) =>
        new Promise<ApiResponse<Tag>>((resolve) => {
          release = resolve;
        }),
    );
    const writes = createFormWrites({
      fields: ["name"],
      refresh: journal.refresh,
      forget: journal.forget,
      onStateChange: (state) => states.push(state.pending),
      writes: () => ({ create: { kind: "create", send, onDone } }),
    });

    const first = writes.submit.create({ name: "Food" });
    const second = writes.submit.create({ name: "Food again" });
    expect(writes.state()).toMatchObject({
      pending: true,
      running: ["create"],
    });
    release(accepted({ id: "t1", name: "Food" }));
    await Promise.all([first, second]);

    expect(send).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(states).toEqual([true, false]);
  });

  test("reads the latest write options on each submit", async () => {
    const journal = createJournal();
    let current = vi.fn();
    const writes = createFormWrites({
      fields: [],
      refresh: journal.refresh,
      forget: journal.forget,
      writes: () => ({
        remove: {
          kind: "delete",
          send: async () => accepted(undefined),
          onDone: current,
        },
      }),
    });
    const first = current;
    current = vi.fn();

    await writes.submit.remove();

    expect(first).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledTimes(1);
  });
});
