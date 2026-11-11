import { describe, expect, test } from "vitest";
import { createFieldOf, pointerSegments } from "./field-pointer";

describe("pointerSegments", () => {
  test("reads a JSON Pointer fragment as its decoded segments", () => {
    expect(pointerSegments("#/openingAmount/value")).toEqual([
      "openingAmount",
      "value",
    ]);
    expect(pointerSegments("#/a~1b/c~0d")).toEqual(["a/b", "c~d"]);
  });

  test("reads the document root as one empty segment", () => {
    expect(pointerSegments("#/")).toEqual([""]);
  });
});

describe("createFieldOf", () => {
  test("reads a field back from the pointer's first segment", () => {
    const fieldOf = createFieldOf(["name", "openingAmount"]);

    expect(fieldOf("#/name")).toBe("name");
    expect(fieldOf("#/openingAmount/value")).toBe("openingAmount");
  });

  test("claims nothing for an input the form does not show", () => {
    const fieldOf = createFieldOf(["name"]);

    expect(fieldOf("#/type")).toBeUndefined();
    expect(fieldOf("#/")).toBeUndefined();
  });

  test("reads a nested field through its own pointer path", () => {
    const fieldOf = createFieldOf(["name", "parent", "parentName"], {
      parentName: "#/parent/create/name",
    });

    expect(fieldOf("#/parent/create/name")).toBe("parentName");
    expect(fieldOf("#/parent")).toBe("parent");
    expect(fieldOf("#/name")).toBe("name");
  });

  test("prefers the longest path a pointer reaches", () => {
    const fieldOf = createFieldOf(["parent", "parentName"], {
      parentName: "#/parent/create/name",
    });

    expect(fieldOf("#/parent/create/iconId")).toBe("parent");
    expect(fieldOf("#/parent/create/name/extra")).toBe("parentName");
  });
});
