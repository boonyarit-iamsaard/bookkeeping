import type { Result } from "@bookkeeping/domain/result";
import { err } from "@bookkeeping/domain/result";
import type { ApiProblem, ApiResponse } from "./problem";
import { readApiResponse } from "./problem";

/** The header parameter creation routes document, as the generated types spell it. */
export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";

/** What one delivery attempt carries beside the input. */
export interface WriteAttempt {
  /**
   * The `Idempotency-Key` header naming this one creation, ready to pass as
   * `params: { header }` to a generated creation call. Every attempt of a
   * submit sends the same key, so a replay answers with the original outcome.
   */
  header: { [IDEMPOTENCY_KEY_HEADER]: string };
}

/** A field rejection with the request field its pointer addresses. */
export interface ApiFieldError {
  /** The top-level request field, decoded from the pointer's first segment. */
  field: string;
  pointer: string;
  code: string;
  detail?: string;
}

/** A definitive rejection: the API answered and nothing was saved. */
export interface ApiRejection {
  status: number;
  problem: ApiProblem;
  /** Every field rejection the problem carried, for callers that map their own. */
  errors: readonly ApiFieldError[];
  /** Message per request field, in the shape the `FieldErrors` component reads. */
  fieldErrors: Readonly<Record<string, string>>;
  /** The error-bar message: the problem itself, or a field error no form field shows. */
  message: string | undefined;
}

export type WriteResult<Output> = Result<Output, ApiRejection>;

export type DescribeFieldError = (
  fieldError: Readonly<ApiFieldError>,
) => string;

export interface WriteOptions<Input, Output> {
  /** Performs the request through the generated client with the attempt's header. */
  send: (
    input: Input,
    attempt: Readonly<WriteAttempt>,
  ) => Promise<ApiResponse<Output>>;
  /**
   * The message shown beside a rejected field. Features supply their own
   * table; the default falls back to the problem's own prose.
   */
  describeFieldError?: DescribeFieldError;
  /**
   * The form field a pointer addresses, or `undefined` when the form shows
   * no field for it. The default takes the pointer's first segment. An
   * error no field claims becomes the message, so none goes unseen.
   */
  fieldOf?: FieldOf;
}

export type FieldOf = (pointer: string) => string | undefined;

export interface WriteSubmissionOptions {
  generateKey?: () => string;
}

export interface WriteSubmission<Input, Output> {
  /**
   * Delivers the input once, replaying the same key when the response is
   * lost. While a delivery is in flight, another submit joins it instead of
   * starting a second request. A loss that survives the replay is thrown.
   */
  submit: (
    input: Input,
    options: Readonly<WriteOptions<Input, Output>>,
  ) => Promise<WriteResult<Output>>;
}

const FALLBACK_FIELD_MESSAGE = "This value was not accepted.";

function defaultDescribeFieldError(fieldError: Readonly<ApiFieldError>) {
  return fieldError.detail ?? FALLBACK_FIELD_MESSAGE;
}

/** RFC 6901: the first segment after `#/`, with `~1` and `~0` unescaped. */
function toRequestField(pointer: string): string {
  const [segment = ""] = pointer.replace(/^#?\//, "").split("/");
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function defaultFieldOf(pointer: string): string | undefined {
  return toRequestField(pointer) || undefined;
}

/** Claims a pointer for the form field its first segment names, if the form shows it. */
export function createFieldOf(fields: readonly string[]): FieldOf {
  return (pointer) => {
    const field = toRequestField(pointer);
    return fields.includes(field) ? field : undefined;
  };
}

/** The messages for the fields a form shows, typed by those fields. */
export function pickFieldErrors<Field extends string>(
  fieldErrors: Readonly<Record<string, string>>,
  fields: readonly Field[],
): Partial<Record<Field, string>> {
  const picked: Partial<Record<Field, string>> = {};
  for (const field of fields) {
    const message = fieldErrors[field];
    if (message !== undefined) {
      picked[field] = message;
    }
  }
  return picked;
}

interface RejectionMapping {
  describe: DescribeFieldError;
  fieldOf: FieldOf;
}

function toApiRejection(
  problem: Readonly<ApiProblem>,
  { describe, fieldOf }: Readonly<RejectionMapping>,
): ApiRejection {
  const errors = (problem.errors ?? []).map((fieldError) => ({
    ...fieldError,
    field: toRequestField(fieldError.pointer),
  }));
  const fieldErrors: Record<string, string> = {};
  let unplaced: ApiFieldError | undefined;
  for (const fieldError of errors) {
    const field = fieldOf(fieldError.pointer);
    if (field === undefined) {
      unplaced ??= fieldError;
    } else if (!(field in fieldErrors)) {
      fieldErrors[field] = describe(fieldError);
    }
  }

  let message: string | undefined;
  if (unplaced) {
    message = describe(unplaced);
  } else if (errors.length === 0) {
    message = problem.detail ?? problem.title;
  }

  return { status: problem.status, problem, errors, fieldErrors, message };
}

/** `fetch` rejects with a `TypeError` when the request never left or its answer never arrived. */
function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

export function createWriteSubmission<Input, Output>({
  generateKey = () => crypto.randomUUID(),
}: Readonly<WriteSubmissionOptions> = {}): WriteSubmission<Input, Output> {
  let inFlight: Promise<WriteResult<Output>> | undefined;

  async function deliver(
    input: Input,
    options: Readonly<WriteOptions<Input, Output>>,
  ): Promise<WriteResult<Output>> {
    const attempt: WriteAttempt = {
      header: { [IDEMPOTENCY_KEY_HEADER]: generateKey() },
    };
    let delivered: ApiResponse<Output>;
    try {
      delivered = await options.send(input, attempt);
    } catch (error) {
      if (!isNetworkError(error)) {
        throw error;
      }
      // The same key makes one replay safe; a second loss is the caller's
      // to report.
      delivered = await options.send(input, attempt);
    }
    const outcome = readApiResponse(delivered);
    if (outcome.ok) {
      return outcome;
    }
    const describe = options.describeFieldError ?? defaultDescribeFieldError;
    return err(
      toApiRejection(outcome.error, {
        describe,
        fieldOf: options.fieldOf ?? defaultFieldOf,
      }),
    );
  }

  return {
    submit(input, options) {
      inFlight ??= deliver(input, options).finally(() => {
        inFlight = undefined;
      });
      return inFlight;
    },
  };
}
