import { describe, expect, test } from "vitest";
import type { SharedRejectionCode } from "./rejection-wording";
import {
  createFieldErrorDescriber,
  describeRejection,
  describeSharedRejection,
  FALLBACK_FIELD_MESSAGE,
} from "./rejection-wording";
import type { ApiFieldError, ApiRejection } from "./write-submission";

const OWN_MESSAGE = "The problem's own words";

function rejection(code: string, message = OWN_MESSAGE): ApiRejection {
  return {
    status: 400,
    problem: { status: 400, code, title: "Title" },
    errors: [],
    fieldErrors: {},
    message,
  };
}

function fieldError(code: string): ApiFieldError {
  return { field: "name", pointer: "#/name", code };
}

// Every code every feature answers alike; a new one fails to compile here
// until it is worded.
const SHARED_MESSAGES: Record<SharedRejectionCode, string> = {
  unauthenticated: "Sign in again to continue.",
  "not-found":
    "This item no longer exists. It may have been deleted elsewhere.",
};

describe("describeSharedRejection", () => {
  test.each(Object.entries(SHARED_MESSAGES))(
    "words %s once",
    (code, message) => {
      expect(describeSharedRejection(code)).toBe(message);
    },
  );

  test("words nothing a feature answers on its own", () => {
    expect(describeSharedRejection("duplicate-name")).toBeUndefined();
    expect(describeSharedRejection("toString")).toBeUndefined();
  });
});

describe("describeRejection", () => {
  test.each(Object.entries(SHARED_MESSAGES))(
    "words a %s problem in the shared voice",
    (code, message) => {
      expect(describeRejection(rejection(code))).toBe(message);
    },
  );

  test("leaves any other problem to its own message", () => {
    expect(describeRejection(rejection("conflict"))).toBe(OWN_MESSAGE);
    expect(
      describeRejection({ ...rejection("conflict"), message: undefined }),
    ).toBeUndefined();
  });
});

describe("createFieldErrorDescriber", () => {
  const describeFieldError = createFieldErrorDescriber({
    "blank-name": "Enter a name.",
    "duplicate-name": "Taken.",
  });

  test("words each code the feature publishes", () => {
    expect(describeFieldError(fieldError("blank-name"))).toBe("Enter a name.");
    expect(describeFieldError(fieldError("duplicate-name"))).toBe("Taken.");
  });

  test("words an unrecognised code with the shared fallback, ignoring any detail", () => {
    expect(
      describeFieldError({ ...fieldError("renamed-code"), detail: "Prose" }),
    ).toBe("This value was not accepted.");
    expect(FALLBACK_FIELD_MESSAGE).toBe("This value was not accepted.");
  });

  test("does not read an inherited property as a code", () => {
    expect(describeFieldError(fieldError("toString"))).toBe(
      FALLBACK_FIELD_MESSAGE,
    );
  });
});
