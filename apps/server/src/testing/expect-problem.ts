import { expect } from "vitest";
import {
  PROBLEM_MEDIA_TYPE,
  problemDetailsSchema,
} from "../core/http/problem-details.js";

export interface ExpectedProblem {
  status: number;
  code: string;
}

/** Asserts a Problem Details response and returns the parsed body. */
export async function expectProblem(
  response: Response,
  expected: Readonly<ExpectedProblem>,
) {
  expect(response.status).toBe(expected.status);
  expect(response.headers.get("content-type")).toContain(PROBLEM_MEDIA_TYPE);
  const problem = problemDetailsSchema.parse(await response.json());
  expect(problem.code).toBe(expected.code);
  expect(problem.type).toBe(`urn:bookkeeping:problem:${expected.code}`);
  expect(problem.status).toBe(expected.status);
  return problem;
}
