import type { Database } from "@bookkeeping/database/connection";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import type { WalletSummary } from "@bookkeeping/domain/wallets";
import { isUuid } from "../shared/identifier";
import type { WalletNotFound, WalletRef } from "./wallet";
import {
  loadWalletForUpdate,
  readWalletSummaryAfterChange,
  recordWalletChange,
  updateWallet,
} from "./wallet-change";

export interface ChangeWalletStateInput extends WalletRef {
  /** True archives, false restores; omitted leaves the archive state alone. */
  archived?: boolean;
  /** Marks or unmarks a Savings wallet; omitted leaves the marker alone. */
  savings?: boolean;
}

export type ChangeWalletStateError = WalletNotFound;

/**
 * Applies partial wallet state under one exclusive lock and transaction.
 * Each changed field records its own before/after history; unchanged fields
 * record nothing. Unknown, malformed and unowned ids are not found alike.
 */
export async function changeWalletState(
  db: Database,
  input: Readonly<ChangeWalletStateInput>,
): Promise<Result<WalletSummary, ChangeWalletStateError>> {
  if (!isUuid(input.id)) {
    return err({ code: "wallet-not-found" });
  }
  return db.transaction(async (tx) => {
    let current = await loadWalletForUpdate(tx, input);
    if (!current) {
      return err({ code: "wallet-not-found" });
    }
    for (const change of requestedStateChanges(current, input)) {
      const updated = await updateWallet(tx, { id: input.id, set: change.set });
      await recordWalletChange(tx, {
        ref: input,
        action: change.action,
        before: current,
        after: updated,
      });
      current = updated;
    }
    return ok(await readWalletSummaryAfterChange(tx, input));
  });
}

function* requestedStateChanges(
  current: Readonly<Pick<WalletSummary, "archivedAt" | "savings">>,
  input: Readonly<ChangeWalletStateInput>,
) {
  if (
    input.archived !== undefined &&
    Boolean(current.archivedAt) !== input.archived
  ) {
    yield {
      set: { archivedAt: input.archived ? new Date() : null },
      action: input.archived ? ("archive" as const) : ("unarchive" as const),
    };
  }
  if (input.savings !== undefined && current.savings !== input.savings) {
    yield {
      set: { savings: input.savings },
      action: input.savings
        ? ("mark-savings" as const)
        : ("unmark-savings" as const),
    };
  }
}
