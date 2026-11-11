import type { WalletRejection } from "@bookkeeping/application/wallets";
import { describe, expect, it } from "vitest";
import { createUnitTestApp } from "../../testing/create-unit-test-app.js";
import {
  documentedOperation,
  documentedSchema,
  documentedSchemaRef,
  fetchDocument,
} from "../../testing/openapi-document.js";
import { walletCodes } from "./wallet-rejection.js";

describe("the published wallet rejections", () => {
  it("publish the field-error codes as a union beside plain request-validation codes", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const create = documentedOperation(document, {
      method: "post",
      path: "/v1/wallets",
    });
    const replaceOpening = documentedOperation(document, {
      method: "put",
      path: "/v1/wallets/{walletId}/opening",
    });

    for (const operation of [create, replaceOpening]) {
      expect(
        documentedSchemaRef(operation, {
          status: "422",
          mediaType: "application/problem+json",
        }),
      ).toBe("#/components/schemas/WalletRejectionProblem");
    }
    expect(
      documentedSchema(document, "WalletPlainRuleFieldError").properties?.code
        .enum,
    ).toEqual([
      "empty",
      "out-of-range",
      "invalid",
      "in-future",
      "movement-before-opening",
    ]);
    // A request-validation code is any string: it never joins the union.
    expect(
      documentedSchema(document, "WalletValidationFieldError").properties?.code
        .type,
    ).toBe("string");
  });

  it("publish the blocker code a delete can answer as the documented 409", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const remove = documentedOperation(document, {
      method: "delete",
      path: "/v1/wallets/{walletId}",
    });

    expect(
      documentedSchemaRef(remove, {
        status: "409",
        mediaType: "application/problem+json",
      }),
    ).toBe("#/components/schemas/HistoryRemainsProblem");
    expect(
      documentedSchema(document, "HistoryRemainsProblem").properties?.code
        .const,
    ).toBe("history-remains");
  });
});

describe("the wallet code table", () => {
  it.each<WalletRejection>([
    { code: "empty", field: "name" },
    { code: "out-of-range", field: "openingAmount" },
    { code: "invalid", field: "openingDate" },
    { code: "in-future", field: "openingDate" },
    { code: "movement-before-opening", field: "openingDate" },
  ])("projects $code to its pointer and code alone", (rejection) => {
    expect(walletCodes.project(rejection, "#/somewhere")).toEqual({
      pointer: "#/somewhere",
      code: rejection.code,
    });
  });
});
