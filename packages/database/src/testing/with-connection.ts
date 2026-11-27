import type { DatabaseConnection } from "../connection";
import { createDatabase } from "../connection";

/** Runs `use` against a connection to `url` and closes it once `use` settles. */
export async function withConnection<Result>(
  url: string,
  use: (connection: DatabaseConnection) => Promise<Result>,
) {
  const connection = createDatabase(url);
  try {
    return await use(connection);
  } finally {
    await connection.close();
  }
}
