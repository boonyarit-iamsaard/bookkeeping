import { parseDatabaseUrl } from "@bookkeeping/database/database-url";
import { allowOtherAccountsFlag } from "@bookkeeping/database/demo-account";
import { freshDatabase } from "@bookkeeping/database/migrate";
import { formatDemoCredentials } from "./demo-credentials";
import { seedSampleLedger } from "./sample-ledger";

const seedFlag = "--seed";

try {
  const url = parseDatabaseUrl();
  const allowOtherAccounts = process.argv.includes(allowOtherAccountsFlag);
  await freshDatabase(url, { allowOtherAccounts });
  if (process.argv.includes(seedFlag)) {
    // The reset left no Account behind, so the seed needs no override.
    console.log(formatDemoCredentials(await seedSampleLedger(url)));
  }
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
