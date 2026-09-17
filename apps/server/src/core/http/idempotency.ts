import { validator } from "hono-openapi";
import * as z from "zod";
import type { ProblemOptions } from "./problem-details.js";
import { createProblemResponse } from "./problem-details.js";

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/**
 * The header as Hono's validator sees it, lower-cased. A usable key has
 * visible characters and a bounded length; a blank or over-long key is as
 * unusable as a missing one.
 */
export const idempotencyKeyHeaderSchema = z.object({
  "idempotency-key": z
    .string()
    .trim()
    .min(1)
    .max(255)
    .meta({ description: "A client-generated key naming this one creation" }),
});

export const idempotencyKeyRequiredProblem: ProblemOptions = {
  code: "idempotency-key-required",
  status: 400,
  title: `A usable ${IDEMPOTENCY_KEY_HEADER} header is required`,
};

export const idempotencyConflictProblem: ProblemOptions<409> = {
  code: "idempotency-conflict",
  status: 409,
  title: `${IDEMPOTENCY_KEY_HEADER} reused with a different payload`,
};

/**
 * Requires a usable key before a creation route reads its body. It documents
 * the header parameter and answers the stable 400 problem when the key is
 * missing, blank, or over-long.
 */
export const idempotencyKeyMiddleware = validator(
  "header",
  idempotencyKeyHeaderSchema,
  (result, c) => {
    if (!result.success) {
      return createProblemResponse(c, idempotencyKeyRequiredProblem);
    }
  },
);
