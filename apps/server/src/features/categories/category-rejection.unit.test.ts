import { describe, expect, it } from "vitest";
import { createUnitTestApp } from "../../testing/create-unit-test-app.js";
import {
  documentedOperation,
  documentedSchema,
  documentedSchemaRef,
  fetchDocument,
} from "../../testing/openapi-document.js";

describe("the published category rejections", () => {
  it("publish the field-error codes as a union beside plain request-validation codes", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const create = documentedOperation(document, {
      method: "post",
      path: "/v1/categories",
    });
    const update = documentedOperation(document, {
      method: "patch",
      path: "/v1/categories/{categoryId}",
    });

    for (const operation of [create, update]) {
      expect(
        documentedSchemaRef(operation, {
          status: "422",
          mediaType: "application/problem+json",
        }),
      ).toBe("#/components/schemas/CategoryRejectionProblem");
    }
    expect(
      documentedSchema(document, "CategoryPlainRuleFieldError").properties?.code
        .enum,
    ).toEqual([
      "blank-name",
      "name-too-long",
      "unknown-icon",
      "duplicate-name",
      "parent-not-found",
      "parent-is-child",
      "parent-protected",
      "protected",
    ]);
    // A request-validation code is any string: it never joins the union.
    expect(
      documentedSchema(document, "CategoryValidationFieldError").properties
        ?.code.type,
    ).toBe("string");
  });

  it("publish the removal blockers as the union of the documented 409", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const remove = documentedOperation(document, {
      method: "delete",
      path: "/v1/categories/{categoryId}",
    });

    expect(
      documentedSchemaRef(remove, {
        status: "409",
        mediaType: "application/problem+json",
      }),
    ).toBe("#/components/schemas/CategoryRemovalProblem");
    expect(
      documentedSchema(document, "CategoryRemovalProblem").properties?.code
        .enum,
    ).toEqual(["protected", "has-children", "in-use"]);
  });
});
