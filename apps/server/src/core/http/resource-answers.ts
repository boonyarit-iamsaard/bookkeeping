import type { IdempotencyConflict } from "@bookkeeping/application/idempotency";
import type { NotFound } from "@bookkeeping/application/shared/not-found";
import { isNotFound } from "@bookkeeping/application/shared/not-found";
import type { Result } from "@bookkeeping/domain/result";
import type { Context } from "hono";
import { idempotencyConflictProblem } from "./idempotency.js";
import { describeProblem } from "./openapi.js";
import type { ProblemFieldError, ProblemOptions } from "./problem-details.js";
import {
  createProblemResponse,
  getProblemOptionsForStatus,
} from "./problem-details.js";

const LOCATION_HEADER = "Location";

/** Any refusal the application reports by code: a rejected input or a removal's blocker. */
interface Refusal {
  code: string;
}

function isIdempotencyConflict(
  error: Readonly<Refusal>,
): error is IdempotencyConflict {
  return error.code === "idempotency-conflict";
}

export interface CreationAnswer<
  Outcome,
  Rejection,
  Body extends { id: string },
> {
  /** The application's verdict: the created or replayed value, a rejection, or a key conflict. */
  result: Result<Outcome, Rejection | IdempotencyConflict>;
  /** The created resource as the wire presents it. */
  present: (outcome: Outcome) => Body;
  /** Where each rejection points into the request document. */
  toFieldErrors: (rejection: Rejection) => readonly ProblemFieldError[];
}

/**
 * Answers a resource creation the way every collection does: 201 with the
 * presented resource and its `Location` under the collection path actually
 * served, 409 when the idempotency key was reused with a different payload,
 * and 422 with field errors for a rejected command.
 */
export function answerCreation<
  Outcome,
  Rejection extends Refusal,
  Body extends { id: string },
>(
  c: Context,
  {
    result,
    present,
    toFieldErrors,
  }: Readonly<CreationAnswer<Outcome, Rejection, Body>>,
) {
  if (!result.ok) {
    if (isIdempotencyConflict(result.error)) {
      return createProblemResponse(c, idempotencyConflictProblem);
    }
    return createProblemResponse(c, {
      ...getProblemOptionsForStatus(422),
      errors: toFieldErrors(result.error),
    });
  }
  const body = present(result.value);
  return c.json(body, 201, {
    [LOCATION_HEADER]: `${c.req.path}/${body.id}`,
  });
}

export interface ReadAnswer<Value, Body> {
  /** Null when missing, deleted, another owner's, or malformed alike. */
  value: Value | null;
  present: (value: Value) => Body;
}

/** A read answers 200 with the presented resource, or the indistinguishable 404. */
export function answerRead<Value, Body>(
  c: Context,
  { value, present }: Readonly<ReadAnswer<Value, Body>>,
) {
  if (value === null) {
    return createProblemResponse(c, getProblemOptionsForStatus(404));
  }
  return c.json(present(value), 200);
}

export interface CorrectionAnswer<Value, Rejection, Body> {
  result: Result<Value, NotFound | Rejection>;
  present: (value: Value) => Body;
  /** Field errors for a rejected command; the shared not-found never reaches it. */
  toFieldErrors: (rejection: Rejection) => readonly ProblemFieldError[];
}

/**
 * Answers a correction: 404 for the shared not-found, 422 with field errors
 * for a rejected command, and 200 with the corrected resource.
 */
export function answerCorrection<Value, Rejection extends Refusal, Body>(
  c: Context,
  {
    result,
    present,
    toFieldErrors,
  }: Readonly<CorrectionAnswer<Value, Rejection, Body>>,
) {
  if (!result.ok) {
    if (isNotFound(result.error)) {
      return createProblemResponse(c, getProblemOptionsForStatus(404));
    }
    return createProblemResponse(c, {
      ...getProblemOptionsForStatus(422),
      errors: toFieldErrors(result.error),
    });
  }
  return c.json(present(result.value), 200);
}

export interface UnblockedRemovalAnswer {
  result: Result<unknown, NotFound>;
}

export interface RemovalAnswer<Blocker> {
  result: Result<unknown, NotFound | Blocker>;
  /** The 409 that names why the resource's own state refuses the removal. */
  toBlockerProblem: (blocker: Blocker) => ProblemOptions<409>;
}

/** Answers a removal: 404 for the shared not-found, 409 naming the blocker, or an empty 204. */
export function answerRemoval<Blocker extends Refusal>(
  c: Context,
  { result, toBlockerProblem }: Readonly<RemovalAnswer<Blocker>>,
) {
  if (!result.ok) {
    if (isNotFound(result.error)) {
      return createProblemResponse(c, getProblemOptionsForStatus(404));
    }
    return createProblemResponse(c, toBlockerProblem(result.error));
  }
  return c.body(null, 204);
}

/** Answers the removal of a resource whose own state never refuses it: 404 or an empty 204. */
export function answerUnblockedRemoval(
  c: Context,
  { result }: Readonly<UnblockedRemovalAnswer>,
) {
  return answerRemoval(c, { result, toBlockerProblem: refuseNothing });
}

/** Maps the blocker of a removal nothing can block: the type is `never`, so it never runs. */
function refuseNothing(blocker: never): never {
  return blocker;
}

/** The documented responses `answerCreation` produces for one resource schema. */
export function describeCreation<Schema>(resource: string, schema: Schema) {
  return {
    201: {
      description: `The created ${resource}, or the original on a replay`,
      headers: {
        [LOCATION_HEADER]: {
          description: `Where the created ${resource} can be retrieved`,
          schema: { type: "string" },
        },
      },
      content: { "application/json": { vSchema: schema } },
    },
    409: describeProblem(idempotencyConflictProblem),
    422: describeProblem(getProblemOptionsForStatus(422)),
  } as const;
}

/** The documented responses `answerRead` produces. */
export function describeRead<Schema>(description: string, schema: Schema) {
  return {
    200: {
      description,
      content: { "application/json": { vSchema: schema } },
    },
    404: describeProblem(getProblemOptionsForStatus(404)),
  } as const;
}

/** The documented responses `answerCorrection` produces. */
export function describeCorrection<Schema>(
  description: string,
  schema: Schema,
) {
  return {
    ...describeRead(description, schema),
    422: describeProblem(getProblemOptionsForStatus(422)),
  } as const;
}
