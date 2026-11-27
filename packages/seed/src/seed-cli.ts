import { parseDatabaseUrl } from "@bookkeeping/database/database-url";
import { allowOtherAccountsFlag } from "@bookkeeping/database/demo-account";
import { formatDemoCredentials } from "./demo-credentials";
import { seedSampleLedger } from "./sample-ledger";

try {
  const credentials = await seedSampleLedger(parseDatabaseUrl(), {
    allowOtherAccounts: process.argv.includes(allowOtherAccountsFlag),
  });
  console.log(formatDemoCredentials(credentials));
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
