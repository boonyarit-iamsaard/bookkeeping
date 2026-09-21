import { describe, expect, test } from "vitest";
import { ApiProblemError, parseApiProblem } from "./problem";

const problemBody = {
  type: "urn:bookkeeping:problem:invalid-command",
  title: "Command is invalid",
  status: 422,
  code: "invalid-command",
  errors: [{ pointer: "#/name", code: "blank-name" }],
};

describe("parseApiProblem", () => {
  test("keeps a problem document the API answered", () => {
    const response = new Response(null, { status: 422 });
    expect(parseApiProblem(problemBody, response)).toMatchObject(problemBody);
  });

  test("stands in for a body that is not a problem document", () => {
    const response = new Response(null, {
      status: 502,
      statusText: "Bad Gateway",
    });
    expect(parseApiProblem("<html>", response)).toEqual({
      status: 502,
      code: "internal-error",
      title: "Bad Gateway",
    });
  });
});

describe("ApiProblemError", () => {
  test("carries the problem and reads its detail as the message", () => {
    const error = new ApiProblemError({ ...problemBody, detail: "Explained" });
    expect(error.problem.code).toBe("invalid-command");
    expect(error.message).toBe("Explained");
  });
});
