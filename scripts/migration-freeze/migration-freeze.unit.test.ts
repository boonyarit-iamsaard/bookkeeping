import { describe, expect, it } from "vitest";
import { findMigrationFreezeViolations } from "./migration-freeze";

const baseline = "packages/database/drizzle/0000_baseline.sql";
const journalPath = "packages/database/drizzle/meta/_journal.json";

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

  describe("journal", () => {
    const nameStatus = `M\t${journalPath}`;
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
      ).toEqual([`${journalPath}: entry 0 (0000_baseline) changed`]);
    });

    it("names a removed entry", () => {
      expect(
        findMigrationFreezeViolations({
          nameStatus,
          journal: { main: mainJournal, current: journal([]) },
        }),
      ).toEqual([`${journalPath}: entry 0 (0000_baseline) removed`]);
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
      ).toEqual([`${journalPath}: version changed`]);
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
  header: Record<string, string> = {},
): string {
  return JSON.stringify(
    { version: "7", dialect: "postgresql", ...header, entries },
    null,
    2,
  );
}
