import { describe, expect, test } from "vitest";
import type { components } from "@/core/api/openapi.gen";
import type { ApiRejection } from "@/core/api/write-submission";
import {
  describeWalletFieldError,
  describeWalletRejection,
  WALLET_REFUSAL_WORDING,
} from "@/features/wallets/wallet-rejection";

type WalletRejectionCode =
  components["schemas"]["WalletRuleFieldError"]["code"];
type WalletBlockerCode = components["schemas"]["HistoryRemainsProblem"]["code"];

// Every field-error code the API publishes for a wallet; a new or renamed one
// fails to compile here until it is worded.
const EXPECTED_FIELD_MESSAGES: Record<WalletRejectionCode, string> = {
  empty: "Enter a wallet name",
  "out-of-range": "That amount is larger than the app can store",
  invalid: "Enter a real calendar date",
  "in-future": "Opening date cannot be in the future",
  "movement-before-opening":
    "Opening date cannot be after an existing movement, including retained deleted entries. Choose an earlier date.",
};

// Every blocker code a wallet write can answer with.
const EXPECTED_BLOCKER_MESSAGES: Record<WalletBlockerCode, string> = {
  "history-remains":
    "This wallet has retained transaction or change history and cannot be deleted. Archive it to remove it from entry pickers.",
};

function rejection(code: string): ApiRejection {
  return {
    status: 409,
    problem: { status: 409, code, title: "Title" },
    errors: [],
    fieldErrors: {},
    message: "The problem's own words",
  };
}

describe("describeWalletFieldError", () => {
  test.each(Object.entries(EXPECTED_FIELD_MESSAGES))(
    "words %s in the product's voice",
    (code, message) => {
      expect(
        describeWalletFieldError({
          field: "openingDate",
          pointer: "#/openingDate",
          code,
        }),
      ).toBe(message);
    },
  );

  test("words an unpublished code with the shared fallback", () => {
    expect(
      describeWalletFieldError({
        field: "openingAmount",
        pointer: "#/openingAmount/value",
        code: "invalid-format",
      }),
    ).toBe("This value was not accepted.");
  });
});

describe("describeWalletRejection", () => {
  test.each(Object.entries(EXPECTED_BLOCKER_MESSAGES))(
    "words the %s blocker",
    (code, message) => {
      expect(describeWalletRejection(rejection(code))).toBe(message);
    },
  );

  test("words the codes every feature shares in the shared voice", () => {
    expect(describeWalletRejection(rejection("not-found"))).toBe(
      "This item no longer exists. It may have been deleted elsewhere.",
    );
    expect(describeWalletRejection(rejection("unauthenticated"))).toBe(
      "Sign in again to continue.",
    );
  });

  test("leaves any other problem to its own message", () => {
    expect(describeWalletRejection(rejection("conflict"))).toBe(
      "The problem's own words",
    );
  });
});

// Every wallet write, the create form included, declares this wording, so the
// whole request refused alike everywhere reads the same on every screen.
describe("WALLET_REFUSAL_WORDING", () => {
  test.each([
    ["unauthenticated", "Sign in again to continue."],
    [
      "not-found",
      "This item no longer exists. It may have been deleted elsewhere.",
    ],
  ])("words %s in the shared voice", (code, message) => {
    expect(WALLET_REFUSAL_WORDING.describeRejection(rejection(code))).toBe(
      message,
    );
  });

  test("words a field error with the wallet wording", () => {
    expect(
      WALLET_REFUSAL_WORDING.describeFieldError({
        field: "name",
        pointer: "#/name",
        code: "empty",
      }),
    ).toBe("Enter a wallet name");
  });
});
