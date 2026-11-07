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
} from "./wallet";

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
    if (
      input.archived !== undefined &&
      Boolean(current.archivedAt) !== input.archived
    ) {
      const updated = await updateWallet(tx, {
        id: input.id,
        set: { archivedAt: input.archived ? new Date() : null },
      });
      await recordWalletChange(tx, {
        ref: input,
        action: input.archived ? "archive" : "unarchive",
        before: current,
        after: updated,
      });
      current = updated;
    }
    if (input.savings !== undefined && current.savings !== input.savings) {
      const updated = await updateWallet(tx, {
        id: input.id,
        set: { savings: input.savings },
      });
      await recordWalletChange(tx, {
        ref: input,
        action: input.savings ? "mark-savings" : "unmark-savings",
        before: current,
        after: updated,
      });
    }
    return ok(await readWalletSummaryAfterChange(tx, input));
  });
}
