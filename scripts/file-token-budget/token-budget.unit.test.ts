import { describe, expect, it } from "vitest";
import type { TrackedFile } from "./token-budget";
import {
  findBaselineChanges,
  findViolations,
  isExemptPath,
  MAX_BYTES,
  parseBaseline,
} from "./token-budget";

function textFile(path: string, bytes: number): TrackedFile {
  return { path, content: Buffer.alloc(bytes, "a") };
}

describe("findViolations", () => {
  it("allows a file up to 5,000 tokens (20,000 bytes) and flags one byte more", () => {
    const trackedPaths = ["src/a.ts"];
    expect(
      findViolations([textFile("src/a.ts", MAX_BYTES)], {
        trackedPaths,
        baseline: {},
      }),
    ).toEqual([]);
    expect(
      findViolations([textFile("src/a.ts", MAX_BYTES + 1)], {
        trackedPaths,
        baseline: {},
      }),
    ).toEqual([{ kind: "oversized", path: "src/a.ts", tokens: 5_001 }]);
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
    expect(findViolations(files, { trackedPaths: [], baseline: {} })).toEqual(
      [],
    );
  });

  it("skips binary content", () => {
    const image = {
      path: "docs/diagram.png",
      content: Buffer.concat([
        Buffer.from([0x89, 0x50, 0x00]),
        Buffer.alloc(MAX_BYTES * 2, "a"),
      ]),
    };
    expect(findViolations([image], { trackedPaths: [], baseline: {} })).toEqual(
      [],
    );
  });

  it("allows a baselined file that has not grown", () => {
    const files = [textFile("src/big.ts", MAX_BYTES + 400)];
    const baseline = { "src/big.ts": MAX_BYTES + 400 };
    expect(
      findViolations(files, { trackedPaths: ["src/big.ts"], baseline }),
    ).toEqual([]);
  });

  it("flags a baselined file that shrank, so its entry is lowered", () => {
    const files = [textFile("src/big.ts", MAX_BYTES + 100)];
    const baseline = { "src/big.ts": MAX_BYTES + 400 };
    expect(
      findViolations(files, { trackedPaths: ["src/big.ts"], baseline }),
    ).toEqual([
      {
        kind: "shrank",
        path: "src/big.ts",
        bytes: MAX_BYTES + 100,
        baselineBytes: MAX_BYTES + 400,
      },
    ]);
  });

  it("flags a baselined file that grew past its recorded size", () => {
    const files = [textFile("src/big.ts", MAX_BYTES + 401)];
    const baseline = { "src/big.ts": MAX_BYTES + 400 };
    expect(
      findViolations(files, { trackedPaths: ["src/big.ts"], baseline }),
    ).toEqual([
      {
        kind: "grew",
        path: "src/big.ts",
        bytes: MAX_BYTES + 401,
        baselineBytes: MAX_BYTES + 400,
      },
    ]);
  });

  it("flags a baselined file that is now within the limit, so its entry is removed", () => {
    const files = [textFile("src/big.ts", MAX_BYTES)];
    const baseline = { "src/big.ts": MAX_BYTES + 400 };
    expect(
      findViolations(files, { trackedPaths: ["src/big.ts"], baseline }),
    ).toEqual([{ kind: "within-limit", path: "src/big.ts" }]);
  });

  it("flags a baseline entry whose file is no longer tracked", () => {
    const baseline = { "src/gone.ts": MAX_BYTES + 400 };
    expect(findViolations([], { trackedPaths: [], baseline })).toEqual([
      { kind: "untracked", path: "src/gone.ts" },
    ]);
  });

  it("does not flag a baseline entry that is tracked but not among the checked files", () => {
    const baseline = { "src/big.ts": MAX_BYTES + 400 };
    expect(
      findViolations([], { trackedPaths: ["src/big.ts"], baseline }),
    ).toEqual([]);
  });
});

describe("findBaselineChanges", () => {
  it("flags entries the commit adds or raises", () => {
    const committed = { "src/big.ts": MAX_BYTES + 400 };
    const staged = {
      "src/big.ts": MAX_BYTES + 500,
      "src/new.ts": MAX_BYTES + 1,
    };
    expect(findBaselineChanges(committed, staged)).toEqual([
      {
        kind: "baseline-raised",
        path: "src/big.ts",
        bytes: MAX_BYTES + 500,
        committedBytes: MAX_BYTES + 400,
      },
      { kind: "baseline-added", path: "src/new.ts" },
    ]);
  });

  it("allows entries the commit lowers or removes", () => {
    const committed = {
      "src/big.ts": MAX_BYTES + 400,
      "src/gone.ts": MAX_BYTES + 1,
    };
    const staged = { "src/big.ts": MAX_BYTES + 100 };
    expect(findBaselineChanges(committed, staged)).toEqual([]);
  });
});

describe("parseBaseline", () => {
  it("reads a map of paths to byte sizes", () => {
    expect(parseBaseline('{"src/big.ts": 20400}')).toEqual({
      "src/big.ts": 20_400,
    });
  });

  it("rejects an entry that is not a positive whole byte count", () => {
    expect(() => parseBaseline('{"src/big.ts": "20400"}')).toThrow();
    expect(() => parseBaseline('{"src/big.ts": 1.5}')).toThrow();
  });
});

describe("isExemptPath", () => {
  it("does not exempt authored files that merely resemble generated names", () => {
    expect(isExemptPath("apps/web/src/gen.ts")).toBe(false);
    expect(isExemptPath("docs/openapi-notes.md")).toBe(false);
    expect(isExemptPath("packages/database/src/drizzle.schema.ts")).toBe(false);
  });
});
