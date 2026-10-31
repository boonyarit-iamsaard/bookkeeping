import { parseArgs } from "node:util";
import { adoptBaseline } from "./adopt-baseline";
import { parseDatabaseUrl } from "./database-url";

try {
  const { values } = parseArgs({
    options: { check: { type: "boolean", default: false } },
  });
  const result = await adoptBaseline({
    url: parseDatabaseUrl(),
    check: values.check,
  });
  switch (result.status) {
    case "adopted":
      console.log(
        "Adopted: drizzle.__drizzle_migrations records 0000_baseline as applied.",
      );
      break;
    case "matches":
      console.log("The schema matches 0000_baseline. Nothing was written.");
      break;
    case "refused":
      console.error(`Refused: ${result.reason}. Nothing was written.`);
      process.exitCode = 1;
      break;
    case "drifted":
      console.error(
        `Refused: the schema differs from 0000_baseline. Nothing was written.\n${result.diff}`,
      );
      process.exitCode = 1;
      break;
  }
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
