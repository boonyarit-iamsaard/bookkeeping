import type {
  WalletField,
  WalletOpeningField,
  WalletOpeningRejected,
  WalletOpeningRejection,
  WalletRejected,
  WalletRejection,
} from "@bookkeeping/application/wallets";
import {
  defineCodeTable,
  toFieldErrors,
} from "../../core/http/field-rejections.js";

/**
 * Where each refused input lives in a wallet creation document. The money
 * object nests its value, so the amount's pointer reaches inside it.
 */
export const WALLET_CREATION_POINTERS: Readonly<Record<WalletField, string>> = {
  name: "#/name",
  openingAmount: "#/openingAmount/value",
  openingDate: "#/openingDate",
};

/**
 * Where each refused input lives in an opening replacement document. The
 * opening resource names its fields without the prefix the wallet
 * representation carries, so its pointers differ from the creation ones; it
 * never refuses the name.
 */
export const WALLET_OPENING_POINTERS: Readonly<
  Record<WalletOpeningField, string>
> = {
  openingAmount: "#/amount/value",
  openingDate: "#/date",
};

/** Every wallet rule code is published as is: no message names a fact. */
export const walletCodes = defineCodeTable<WalletRejection>("Wallet", {
  empty: "plain",
  "out-of-range": "plain",
  invalid: "plain",
  "in-future": "plain",
  "movement-before-opening": "plain",
});

export const walletRejectionProblemSchema = walletCodes.problemSchema;

/** The field errors of a refused creation, pointing into the creation document. */
export function toCreationFieldErrors(rejected: Readonly<WalletRejected>) {
  return toFieldErrors(rejected, {
    pointers: WALLET_CREATION_POINTERS,
    codes: walletCodes,
  });
}

/** The field errors of a refused opening replacement, pointing into its document. */
export function toOpeningFieldErrors(
  rejected: Readonly<WalletOpeningRejected>,
) {
  return toFieldErrors<WalletOpeningField, WalletOpeningRejection>(rejected, {
    pointers: WALLET_OPENING_POINTERS,
    codes: walletCodes,
  });
}
