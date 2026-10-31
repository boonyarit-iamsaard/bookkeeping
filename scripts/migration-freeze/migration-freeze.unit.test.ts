import { describe, expect, it } from "vitest";
import {
  findMigrationFreezeViolations,
  JOURNAL_PATH,
} from "./migration-freeze";

const baseline = "packages/database/drizzle/0000_baseline.sql";

describe("findMigrationFreezeViolations", () => {
  it("names a modified committed migration", () => {
    expect(
      findMigrationFreezeViolations({ nameStatus: `M\t${baseline}\n` }),
    ).toEqual([`${baseline}: modified`]);
  });

  it("names a deleted snapshot and lets new migrations through", () => {
    const nameStatus = [
      "D\tpackages/database/drizzle/meta/0000_snapshot.json",
      "A\tpackages/database/drizzle/0001_create_budgets_table.sql",
      "A\tpackages/database/drizzle/meta/0001_snapshot.json",
    ].join("\n");

    expect(findMigrationFreezeViolations({ nameStatus })).toEqual([
      "packages/database/drizzle/meta/0000_snapshot.json: deleted",
    ]);
  });

  it("rejects a rename, which --no-renames should have split", () => {
    expect(() =>
      findMigrationFreezeViolations({
        nameStatus: `R100\t${baseline}\tpackages/database/drizzle/0000_renamed.sql`,
      }),
    ).toThrow();
  });

  describe("journal", () => {
    const nameStatus = `M\t${JOURNAL_PATH}`;
    const baselineEntry = {
      idx: 0,
      version: "7",
      when: 1790521579298,
      tag: "0000_baseline",
      breakpoints: true,
    };
    const nextEntry = { ...baselineEntry, idx: 1, tag: "0001_add_budgets" };
    const mainJournal = journal([baselineEntry]);

    it("passes when entries are only appended", () => {
      expect(
        findMigrationFreezeViolations({
          nameStatus,
          journal: {
            main: mainJournal,
            current: journal([baselineEntry, nextEntry]),
          },
        }),
      ).toEqual([]);
    });

    it("names an existing entry that changed", () => {
      expect(
        findMigrationFreezeViolations({
          nameStatus,
          journal: {
            main: mainJournal,
            current: journal([{ ...baselineEntry, when: 1 }, nextEntry]),
          },
        }),
      ).toEqual([`${JOURNAL_PATH}: entry 0 (0000_baseline) changed`]);
    });

    it("names a removed entry", () => {
      expect(
        findMigrationFreezeViolations({
          nameStatus,
          journal: { main: mainJournal, current: journal([]) },
        }),
      ).toEqual([`${JOURNAL_PATH}: entry 0 (0000_baseline) removed`]);
    });

    it("names a changed header field", () => {
      expect(
        findMigrationFreezeViolations({
          nameStatus,
          journal: {
            main: mainJournal,
            current: journal([baselineEntry], { version: "8" }),
          },
        }),
      ).toEqual([`${JOURNAL_PATH}: version changed`]);
    });

    it("passes a reformatted journal with the same entries", () => {
      expect(
        findMigrationFreezeViolations({
          nameStatus,
          journal: {
            main: mainJournal,
            current: JSON.stringify(JSON.parse(mainJournal)),
          },
        }),
      ).toEqual([]);
    });
  });
});

function journal(
  entries: readonly object[],
  header: Readonly<Record<string, string>> = {},
): string {
  return JSON.stringify(
    { version: "7", dialect: "postgresql", ...header, entries },
    null,
    2,
  );
}
