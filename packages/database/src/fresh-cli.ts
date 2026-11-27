import { parseDatabaseUrl } from "./database-url";
import { allowOtherAccountsFlag } from "./demo-account";
import { freshDatabase } from "./migrate";

try {
  await freshDatabase(parseDatabaseUrl(), {
    allowOtherAccounts: process.argv.includes(allowOtherAccountsFlag),
  });
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
