import type { TransactionRejection } from "@bookkeeping/application/transactions";
import { describe, expect, test } from "vitest";
import type { TransactionFieldError } from "./transaction-rejection.js";
import {
  CREATE_FIELD_POINTERS,
  toFieldErrors,
  transactionFieldErrorSchema,
  UPDATE_FIELD_POINTERS,
} from "./transaction-rejection.js";

interface WireCase {
  rejection: TransactionRejection;
  /** The field error a create request answers. */
  create: TransactionFieldError;
  /** Where the same rejection points in an update request document. */
  updatePointer: string;
}

const ARCHIVED_WALLET_ID = "01999999-0000-7000-8000-000000000001";

// Keyed by every rejection code, so a new rejection fails to compile until
// its wire form is asserted here.
const WIRE_CASES: { [Code in TransactionRejection["code"]]: WireCase } = {
  "wallet-not-found": {
    rejection: { field: "walletId", code: "wallet-not-found" },
    create: { pointer: "#/walletId", code: "wallet-not-found" },
    updatePointer: "#/walletId",
  },
  "destination-wallet-not-found": {
    rejection: {
      field: "destinationWalletId",
      code: "destination-wallet-not-found",
    },
    create: {
      pointer: "#/destinationWalletId",
      code: "destination-wallet-not-found",
    },
    updatePointer: "#/destinationWalletId",
  },
  "same-wallet": {
    rejection: { field: "destinationWalletId", code: "same-wallet" },
    create: { pointer: "#/destinationWalletId", code: "same-wallet" },
    updatePointer: "#/destinationWalletId",
  },
  "wallet-archived": {
    rejection: {
      field: "destinationWalletId",
      code: "wallet-archived",
      walletId: ARCHIVED_WALLET_ID,
    },
    create: { pointer: "#/destinationWalletId", code: "wallet-archived" },
    updatePointer: "#/destinationWalletId",
  },
  "invalid-transfer": {
    rejection: { field: "type", code: "invalid-transfer" },
    create: { pointer: "#/type", code: "invalid-transfer" },
    updatePointer: "#/",
  },
  "category-not-found": {
    rejection: { field: "categoryId", code: "category-not-found" },
    create: { pointer: "#/categoryId", code: "category-not-found" },
    updatePointer: "#/categoryId",
  },
  "category-kind-mismatch": {
    rejection: { field: "categoryId", code: "category-kind-mismatch" },
    create: { pointer: "#/categoryId", code: "category-kind-mismatch" },
    updatePointer: "#/categoryId",
  },
  "amount-out-of-range": {
    rejection: { field: "amount", code: "amount-out-of-range" },
    create: { pointer: "#/amount/value", code: "amount-out-of-range" },
    updatePointer: "#/amount/value",
  },
  "note-too-long": {
    rejection: { field: "note", code: "note-too-long" },
    create: { pointer: "#/note", code: "note-too-long" },
    updatePointer: "#/note",
  },
  "too-many-tags": {
    rejection: { field: "tagIds", code: "too-many-tags" },
    create: { pointer: "#/tagIds", code: "too-many-tags" },
    updatePointer: "#/tagIds",
  },
  "tag-not-found": {
    rejection: { field: "tagIds", code: "tag-not-found" },
    create: { pointer: "#/tagIds", code: "tag-not-found" },
    updatePointer: "#/tagIds",
  },
  "invalid-date": {
    rejection: { field: "transactionDate", code: "invalid-date" },
    create: { pointer: "#/transactionDate", code: "invalid-date" },
    updatePointer: "#/transactionDate",
  },
  "future-date": {
    rejection: {
      field: "transactionDate",
      code: "future-date",
      today: "2026-09-10",
    },
    create: { pointer: "#/transactionDate", code: "future-date" },
    updatePointer: "#/transactionDate",
  },
  "before-opening": {
    rejection: {
      field: "transactionDate",
      code: "before-opening",
      openingDate: "2026-09-01",
    },
    create: {
      pointer: "#/transactionDate",
      code: "before-opening",
      openingDate: "2026-09-01",
    },
    updatePointer: "#/transactionDate",
  },
  "invalid-refund": {
    rejection: { field: "type", code: "invalid-refund" },
    create: { pointer: "#/type", code: "invalid-refund" },
    updatePointer: "#/",
  },
  "expense-not-found": {
    rejection: { field: "refundOfTransactionId", code: "expense-not-found" },
    create: { pointer: "#/refundOfTransactionId", code: "expense-not-found" },
    updatePointer: "#/",
  },
  "before-expense": {
    rejection: {
      field: "transactionDate",
      code: "before-expense",
      expenseDate: "2026-09-02",
    },
    create: {
      pointer: "#/transactionDate",
      code: "before-expense",
      expenseDate: "2026-09-02",
    },
    updatePointer: "#/transactionDate",
  },
  "exceeds-refundable": {
    rejection: {
      field: "amount",
      code: "exceeds-refundable",
      refundAllowance: 2_000n,
    },
    create: {
      pointer: "#/amount/value",
      code: "exceeds-refundable",
      refundAllowance: { value: "20.00", currency: "THB" },
    },
    updatePointer: "#/amount/value",
  },
  "below-refunded": {
    rejection: {
      field: "amount",
      code: "below-refunded",
      refundedTotal: 15_000n,
    },
    create: {
      pointer: "#/amount/value",
      code: "below-refunded",
      refundedTotal: { value: "150.00", currency: "THB" },
    },
    updatePointer: "#/amount/value",
  },
  "after-refund": {
    rejection: {
      field: "transactionDate",
      code: "after-refund",
      refundDate: "2026-09-03",
    },
    create: {
      pointer: "#/transactionDate",
      code: "after-refund",
      refundDate: "2026-09-03",
    },
    updatePointer: "#/transactionDate",
  },
};

describe("transaction field errors", () => {
  test.for(Object.entries(WIRE_CASES))(
    "%s addresses its field and carries exactly the facts its message names",
    ([, { rejection, create, updatePointer }]) => {
      const created = toFieldErrors(rejection, CREATE_FIELD_POINTERS);
      expect(created).toEqual([create]);
      expect(transactionFieldErrorSchema.parse(created[0])).toEqual(create);
      expect(toFieldErrors(rejection, UPDATE_FIELD_POINTERS)).toEqual([
        { ...create, pointer: updatePointer },
      ]);
    },
  );

  test("a rule code never passes without the facts its message names", () => {
    expect(
      transactionFieldErrorSchema.safeParse({
        pointer: "#/amount/value",
        code: "exceeds-refundable",
      }).success,
    ).toBe(false);
  });
});
