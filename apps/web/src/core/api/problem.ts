import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import * as z from "zod";

/** RFC 9457 problem details as the API answers every failure. */
export interface ApiProblem {
  status: number;
  code: string;
  title: string;
  detail?: string;
  /** Rejections addressed to request fields, each by JSON Pointer. */
  errors?: readonly ApiProblemFieldError[];
}

export interface ApiProblemFieldError {
  pointer: string;
  code: string;
  detail?: string;
}

const apiProblemSchema = z.looseObject({
  status: z.number().int(),
  code: z.string(),
  title: z.string(),
  detail: z.string().optional(),
  errors: z
    .array(
      z.object({
        pointer: z.string(),
        code: z.string(),
        detail: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * The problem an unsuccessful response carries, or one standing in for it
 * when the body is not a problem document (a proxy page, an empty body).
 */
export function parseApiProblem(body: unknown, response: Response): ApiProblem {
  const parsed = apiProblemSchema.safeParse(body);
  if (parsed.success) {
    return parsed.data;
  }
  return {
    status: response.status,
    code: response.status >= 500 ? "internal-error" : "bad-request",
    title:
      response.statusText || `Request failed with status ${response.status}`,
  };
}

/** The shape every generated client call resolves to: a body or a failure. */
export type ApiResponse<Output> =
  | { data: Output; response: Response }
  | { error: unknown; response: Response };

/** The documented representation of a success, or the failure's problem. */
export function readApiResponse<Output>(
  result: ApiResponse<Output>,
): Result<Output, ApiProblem> {
  if ("data" in result && result.response.ok) {
    return ok(result.data);
  }
  const body = "error" in result ? result.error : undefined;
  return err(parseApiProblem(body, result.response));
}

/** A read the API refused; thrown so the query layer sees the failure. */
export class ApiProblemError extends Error {
  readonly problem: ApiProblem;

  constructor(problem: ApiProblem) {
    super(problem.detail ?? problem.title);
    this.name = "ApiProblemError";
    this.problem = problem;
  }
}
