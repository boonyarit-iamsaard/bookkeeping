import { describe, expect, it } from "vitest";
import {
  findOversizedFiles,
  isExemptPath,
  MAX_BYTES,
} from "./find-oversized-files";

function textFile(path: string, bytes: number) {
  return { path, content: Buffer.alloc(bytes, "a") };
}

describe("findOversizedFiles", () => {
  it("allows a file up to 5,000 tokens (20,000 bytes) and flags one byte more", () => {
    expect(findOversizedFiles([textFile("src/a.ts", MAX_BYTES)])).toEqual([]);
    expect(findOversizedFiles([textFile("src/a.ts", MAX_BYTES + 1)])).toEqual([
      { path: "src/a.ts", tokens: 5_001 },
    ]);
  });

  it("skips lockfiles, codegen and migrations, however large", () => {
    const files = [
      textFile("pnpm-lock.yaml", MAX_BYTES * 10),
      textFile("apps/web/src/core/api/openapi.gen.ts", MAX_BYTES * 10),
      textFile("apps/web/src/core/api/openapi.json", MAX_BYTES * 10),
      textFile(
        "packages/database/drizzle/meta/0001_snapshot.json",
        MAX_BYTES * 10,
      ),
    ];
    expect(findOversizedFiles(files)).toEqual([]);
  });

  it("skips binary content", () => {
    const image = {
      path: "docs/diagram.png",
      content: Buffer.concat([
        Buffer.from([0x89, 0x50, 0x00]),
        Buffer.alloc(MAX_BYTES * 2, "a"),
      ]),
    };
    expect(findOversizedFiles([image])).toEqual([]);
  });

  it("reports only the oversized files among several", () => {
    const files = [
      textFile("src/small.ts", 100),
      textFile("src/large.ts", MAX_BYTES + 400),
    ];
    expect(findOversizedFiles(files)).toEqual([
      { path: "src/large.ts", tokens: 5_100 },
    ]);
  });
});

describe("isExemptPath", () => {
  it("does not exempt authored files that merely resemble generated names", () => {
    expect(isExemptPath("apps/web/src/gen.ts")).toBe(false);
    expect(isExemptPath("docs/openapi-notes.md")).toBe(false);
    expect(isExemptPath("packages/database/src/drizzle.schema.ts")).toBe(false);
  });
});
