import type { ApiResponse } from "./problem";
import type {
  ApiRejection,
  DescribeFieldError,
  WriteAttempt,
  WriteOptions,
  WriteResult,
} from "./write-submission";
import { createFieldOf, createWriteSubmission } from "./write-submission";

/**
 * What a write does to its record. It decides the idempotency key (only a
 * creation sends one), what a not-found answer means (a deletion is done),
 * and the wording when the response is lost.
 */
export type WriteKind = "create" | "change" | "delete";

/** A cached read's key, as the query layer spells it. */
export type ReadKey = readonly unknown[];

interface FormWriteCommon<Output> {
  /** The message beside a rejected field; defaults to the problem's prose. */
  describeFieldError?: DescribeFieldError;
  /** The error-bar message for a rejection; defaults to its own message. */
  describeRejection?: (rejection: Readonly<ApiRejection>) => string | undefined;
  /** True when a rejection cites facts newer than the screen shows. */
  refreshOnRejection?: (rejection: Readonly<ApiRejection>) => boolean;
  /** The success step, run once the reads have refreshed. */
  onDone: (value: Output) => unknown;
}

export interface CreateFormWrite<Input, Output>
  extends FormWriteCommon<Output> {
  kind: "create";
  /** Sends the attempt's `Idempotency-Key` header, the same on the replay. */
  send: (
    input: Input,
    attempt: Readonly<WriteAttempt>,
  ) => Promise<ApiResponse<Output>>;
}

export interface ChangeFormWrite<Input, Output>
  extends FormWriteCommon<Output> {
  kind: "change";
  send: (input: Input) => Promise<ApiResponse<Output>>;
}

export interface DeleteFormWrite<Input> extends FormWriteCommon<undefined> {
  kind: "delete";
  send: (input: Input) => Promise<ApiResponse<unknown>>;
  /**
   * The deleted record's own reads: left out of the refresh while its page
   * is still open, and forgotten after the success step.
   */
  retired?: readonly ReadKey[];
}

export type FormWrite<Input, Output> =
  | CreateFormWrite<Input, Output>
  | ChangeFormWrite<Input, Output>
  | DeleteFormWrite<Input>;

type InputOf<Write> = Write extends {
  send: (input: infer Input, ...rest: never[]) => unknown;
}
  ? Input
  : never;

/** The success body; a generated client's failure branch has no `data`. */
type OutputOf<Write> = Write extends {
  send: (...args: never[]) => Promise<infer Response>;
}
  ? Response extends { data: infer Output }
    ? Output
    : never
  : never;

/** A form's named writes, each checked against its own input and output. */
export type FormWriteMap<Writes> = {
  [Name in keyof Writes]: FormWrite<
    InputOf<Writes[Name]>,
    OutputOf<Writes[Name]>
  >;
};

/** A `send` that takes nothing makes a submit that takes nothing. */
export type FormSubmits<Writes> = {
  [Name in keyof Writes]: Writes[Name] extends { send: () => unknown }
    ? () => Promise<void>
    : (input: InputOf<Writes[Name]>) => Promise<void>;
};

/**
 * A write as a form declares it, before its own input and output are known:
 * it types the callbacks a form writes inline. `FormWriteMap` then checks
 * each write against its own input and output; the method signatures here
 * accept any.
 */
export interface DeclaredWrite {
  kind: WriteKind;
  send(
    input: unknown,
    attempt: Readonly<WriteAttempt>,
  ): Promise<ApiResponse<unknown>>;
  describeFieldError?: DescribeFieldError;
  describeRejection?: (rejection: Readonly<ApiRejection>) => string | undefined;
  refreshOnRejection?: (rejection: Readonly<ApiRejection>) => boolean;
  onDone(value: unknown): unknown;
  retired?: readonly ReadKey[];
}

/** A form's writes: each declared, and each checked against itself. */
export type FormWriteSet<Writes> = Record<string, DeclaredWrite> &
  FormWriteMap<Writes>;

/** A write as the core runs it: only a creation is handed an attempt. */
interface RunnableWrite extends Omit<DeclaredWrite, "send"> {
  send(
    input: unknown,
    attempt?: Readonly<WriteAttempt>,
  ): Promise<ApiResponse<unknown>>;
}

export interface FormWritesState<Field extends string, Name> {
  /** True from any submit until its outcome, including the replay. */
  pending: boolean;
  /** The writes in flight, so a form can label the button that started. */
  running: readonly Name[];
  /** The error bar: a lost response, or a rejection no field claims. */
  serverError: string | undefined;
  fieldErrors: Partial<Record<Field, string>>;
}

export interface FormWritesOptions<Field extends string, Writes> {
  /** The fields the form shows; an error for any other joins the error bar. */
  fields: readonly Field[];
  /** The latest write options, read once per submit. */
  writes: () => Writes;
  /** Re-reads after a write, leaving out the retired reads. */
  refresh: (retired: readonly ReadKey[]) => Promise<void>;
  /** Drops retired reads once the success step has run. */
  forget: (retired: readonly ReadKey[]) => void;
  onStateChange?: (
    state: Readonly<FormWritesState<Field, keyof Writes>>,
  ) => void;
}

export interface FormWrites<Field extends string, Writes> {
  /** Settles a named write; a submit while it is in flight joins it. */
  submit: FormSubmits<Writes>;
  state: () => Readonly<FormWritesState<Field, keyof Writes>>;
  /** Clears one field's server error, as editing that field does. */
  clearFieldError: (field: Field) => void;
  /** Clears the error bar and every field error. */
  clearErrors: () => void;
}

const CHANGE_LOST_MESSAGE =
  "The change could not be confirmed. Your values are kept; check your connection and try again.";

const DELETE_LOST_MESSAGE =
  "The deletion could not be confirmed. Check your connection and try again; deleting twice is harmless.";

const NOT_FOUND_STATUS = 404;

/** What one delivery came back with. */
type Delivered<Output> =
  | { outcome: "accepted"; value: Output }
  | { outcome: "rejected"; rejection: Readonly<ApiRejection> }
  | { outcome: "lost" };

type Undelivered = Exclude<Delivered<unknown>, { outcome: "accepted" }>;

async function deliver<Input, Output>(
  input: Input,
  options: Readonly<WriteOptions<Input, Output>>,
): Promise<Delivered<Output>> {
  let result: WriteResult<Output>;
  try {
    // The form joins a submit in flight itself, so each submit delivers anew.
    result = await createWriteSubmission<Input, Output>().submit(
      input,
      options,
    );
  } catch {
    return { outcome: "lost" };
  }
  return result.ok
    ? { outcome: "accepted", value: result.value }
    : { outcome: "rejected", rejection: result.error };
}

/** Not found is a deletion's goal state: a replay, or another tab, got there. */
function isGone(delivered: Readonly<Delivered<unknown>>): boolean {
  return (
    delivered.outcome === "rejected" &&
    delivered.rejection.status === NOT_FOUND_STATUS
  );
}

/**
 * Settles one form's writes the same way: delivery through the write
 * submission, the shared lost-response wording per kind, field errors placed
 * by the form's fields, one error bar cleared when any write starts, and a
 * refresh before the success step. A deletion answered not found is done.
 */
export function createFormWrites<
  Field extends string,
  Writes extends FormWriteSet<Writes>,
>(
  options: Readonly<FormWritesOptions<Field, Writes>>,
): FormWrites<Field, Writes> {
  type Name = keyof Writes;
  const fieldOf = createFieldOf(options.fields);
  const inFlight = new Map<Name, Promise<void>>();
  let state: FormWritesState<Field, Name> = {
    pending: false,
    running: [],
    serverError: undefined,
    fieldErrors: {},
  };

  function update(next: Readonly<Partial<FormWritesState<Field, Name>>>) {
    const running = next.running ?? state.running;
    state = { ...state, ...next, pending: running.length > 0 };
    options.onStateChange?.(state);
  }

  function pickFields(
    fieldErrors: Readonly<Record<string, string>>,
  ): Partial<Record<Field, string>> {
    const picked: Partial<Record<Field, string>> = {};
    for (const field of options.fields) {
      const message = fieldErrors[field];
      if (message !== undefined) {
        picked[field] = message;
      }
    }
    return picked;
  }

  async function fail(
    write: Readonly<RunnableWrite>,
    undelivered: Readonly<Undelivered>,
  ) {
    if (undelivered.outcome === "lost") {
      update({
        serverError:
          write.kind === "delete" ? DELETE_LOST_MESSAGE : CHANGE_LOST_MESSAGE,
      });
      return;
    }
    const { rejection } = undelivered;
    if (write.refreshOnRejection?.(rejection)) {
      await options.refresh([]);
    }
    update({
      serverError: write.describeRejection
        ? write.describeRejection(rejection)
        : rejection.message,
      fieldErrors: pickFields(rejection.fieldErrors),
    });
  }

  async function settle(
    write: Readonly<RunnableWrite>,
    input: unknown,
  ): Promise<void> {
    const delivered = await deliver(input, {
      describeFieldError: write.describeFieldError,
      fieldOf,
      ...(write.kind === "create"
        ? { send: write.send }
        : { keyed: false, send: (value: unknown) => write.send(value) }),
    });
    const done =
      delivered.outcome === "accepted" ||
      (write.kind === "delete" && isGone(delivered));
    if (!done) {
      return fail(write, delivered);
    }
    const retired = write.retired ?? [];
    await options.refresh(retired);
    await write.onDone(
      delivered.outcome === "accepted" && write.kind !== "delete"
        ? delivered.value
        : undefined,
    );
    if (retired.length > 0) {
      options.forget(retired);
    }
  }

  function start(name: Name, input: unknown): Promise<void> {
    const joined = inFlight.get(name);
    if (joined) {
      return joined;
    }
    update({
      running: [...state.running, name],
      serverError: undefined,
      fieldErrors: {},
    });
    const write: Readonly<RunnableWrite> = options.writes()[name];
    const settling = settle(write, input).finally(() => {
      inFlight.delete(name);
      update({ running: state.running.filter((running) => running !== name) });
    });
    inFlight.set(name, settling);
    return settling;
  }

  const submit: Partial<Record<Name, (input?: unknown) => Promise<void>>> = {};
  for (const name in options.writes()) {
    submit[name] = (input) => start(name, input);
  }

  return {
    // biome-ignore lint/nursery/noUnsafeTypeAssertion: the loop above fills a submit for every name the writes declare, each typed by `FormWriteMap` at the form.
    submit: submit as FormSubmits<Writes>,
    state: () => state,
    clearFieldError(field) {
      const fieldErrors = { ...state.fieldErrors };
      delete fieldErrors[field];
      update({ fieldErrors });
    },
    clearErrors() {
      update({ serverError: undefined, fieldErrors: {} });
    },
  };
}
