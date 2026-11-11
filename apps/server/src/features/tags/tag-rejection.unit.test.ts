import { describe, expect, it } from "vitest";
import { createUnitTestApp } from "../../testing/create-unit-test-app.js";
import {
  documentedOperation,
  documentedSchema,
  documentedSchemaRef,
  fetchDocument,
} from "../../testing/openapi-document.js";

describe("the published tag rejections", () => {
  it("publish the field-error codes as a union beside plain request-validation codes", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const create = documentedOperation(document, {
      method: "post",
      path: "/v1/tags",
    });
    const update = documentedOperation(document, {
      method: "patch",
      path: "/v1/tags/{tagId}",
    });

    for (const operation of [create, update]) {
      expect(
        documentedSchemaRef(operation, {
          status: "422",
          mediaType: "application/problem+json",
        }),
      ).toBe("#/components/schemas/TagRejectionProblem");
    }
    expect(
      documentedSchema(document, "TagPlainRuleFieldError").properties?.code
        .enum,
    ).toEqual(["blank-name", "name-too-long", "duplicate-name"]);
    // A request-validation code is any string: it never joins the union.
    expect(
      documentedSchema(document, "TagValidationFieldError").properties?.code
        .type,
    ).toBe("string");
  });
});
