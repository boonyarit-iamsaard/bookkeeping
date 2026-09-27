import { describe, expect, test } from "vitest";
import { createUnitTestApp } from "../../testing/create-unit-test-app.js";

describe("sign-up routes", () => {
  test.each([
    { label: "unset", signUpEnabled: undefined, expected: "open" },
    { label: "enabled", signUpEnabled: true, expected: "open" },
    { label: "disabled", signUpEnabled: false, expected: "closed" },
  ])(
    "answers $label sign-up state without a session",
    async ({ signUpEnabled, expected }) => {
      const response = await createUnitTestApp({ signUpEnabled }).request(
        "/sign-up",
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ signUp: expected });
    },
  );
});
