import { describe, expect, test } from "vitest";
import type { ApiFieldError } from "@/core/api/write-submission";
import type { TransactionRejectionCode } from "@/features/transactions/transaction-rejection";
import {
  carriesFacts,
  describeTransactionFieldError,
  transactionFieldOf,
} from "@/features/transactions/transaction-rejection";

function fieldError(
  error: Readonly<Omit<ApiFieldError, "field">> & Record<string, unknown>,
): ApiFieldError {
  return { ...error, field: "" };
}

// Every code the API publishes, at the pointer a create request addresses it
// to, with where it shows and what it says. Kept by hand from the server's
// pointer table and the agreed wording.
const REJECTIONS: readonly {
  code: TransactionRejectionCode;
  pointer: string;
  facts?: Record<string, unknown>;
  field: string | undefined;
  message: string;
}[] = [
  {
    code: "wallet-not-found",
    pointer: "#/walletId",
    field: "walletId",
    message: "That wallet is not available. Choose another wallet.",
  },
  {
    code: "destination-wallet-not-found",
    pointer: "#/destinationWalletId",
    field: "destinationWalletId",
    message: "That destination wallet is not available. Choose another wallet.",
  },
  {
    code: "same-wallet",
    pointer: "#/destinationWalletId",
    field: "destinationWalletId",
    message:
      "Choose two different available wallets. Transfers have no category.",
  },
  {
    code: "wallet-archived",
    pointer: "#/walletId",
    field: "walletId",
    message:
      "That wallet is archived. Choose an active wallet or retain this transaction’s existing wallets.",
  },
  {
    code: "invalid-transfer",
    pointer: "#/type",
    field: undefined,
    message:
      "Choose two different available wallets. Transfers have no category.",
  },
  {
    code: "category-not-found",
    pointer: "#/categoryId",
    field: "categoryId",
    message: "That category is not available for this type. Choose another.",
  },
  {
    code: "category-kind-mismatch",
    pointer: "#/categoryId",
    field: "categoryId",
    message: "That category is not available for this type. Choose another.",
  },
  {
    code: "amount-out-of-range",
    pointer: "#/amount/value",
    field: "amount",
    message: "The amount must be between ฿0.01 and ฿99,999,999.99",
  },
  {
    code: "note-too-long",
    pointer: "#/note",
    field: "note",
    message: "Notes can be at most 200 characters",
  },
  {
    code: "invalid-date",
    pointer: "#/transactionDate",
    field: "transactionDate",
    message: "Enter a real calendar date",
  },
  {
    code: "future-date",
    pointer: "#/transactionDate",
    field: "transactionDate",
    message: "The date cannot be in the future",
  },
  {
    code: "before-opening",
    pointer: "#/transactionDate",
    facts: { openingDate: "2026-09-01" },
    field: "transactionDate",
    message: "This wallet opened on 1 Sep 2026; earlier dates are not tracked",
  },
  {
    code: "invalid-refund",
    pointer: "#/type",
    field: undefined,
    message: "Only a current expense can be refunded",
  },
  {
    code: "expense-not-found",
    pointer: "#/refundOfTransactionId",
    field: undefined,
    message: "This expense no longer exists, so it can't be refunded",
  },
  {
    code: "before-expense",
    pointer: "#/transactionDate",
    facts: { expenseDate: "2026-09-02" },
    field: "transactionDate",
    message:
      "The expense is dated 2 Sep 2026; its refund cannot come before it",
  },
  {
    code: "exceeds-refundable",
    pointer: "#/amount/value",
    facts: { refundAllowance: { value: "300.00", currency: "THB" } },
    field: "amount",
    message: "Only ฿300.00 of this expense is left to refund",
  },
  {
    code: "below-refunded",
    pointer: "#/amount/value",
    facts: { refundedTotal: { value: "150.00", currency: "THB" } },
    field: "amount",
    message:
      "฿150.00 of this expense has been refunded; the amount cannot go below that",
  },
  {
    code: "after-refund",
    pointer: "#/transactionDate",
    facts: { refundDate: "2026-09-03" },
    field: "transactionDate",
    message:
      "A linked refund is dated 3 Sep 2026; the expense cannot come after it",
  },
];

describe("transaction rejections", () => {
  test.each(REJECTIONS)(
    "$code shows in $field with its own message",
    ({ code, pointer, facts, field, message }) => {
      expect(transactionFieldOf(pointer)).toBe(field);
      expect(
        describeTransactionFieldError(fieldError({ pointer, code, ...facts })),
      ).toBe(message);
    },
  );

  test("a fully used allowance says the expense is fully refunded", () => {
    expect(
      describeTransactionFieldError(
        fieldError({
          pointer: "#/amount/value",
          code: "exceeds-refundable",
          refundAllowance: { value: "0.00", currency: "THB" },
        }),
      ),
    ).toBe("This expense is already fully refunded");
  });

  test("a missing fact falls back to the code's plain message", () => {
    const error = fieldError({
      pointer: "#/amount/value",
      code: "exceeds-refundable",
    });
    expect(describeTransactionFieldError(error)).toBe(
      "The amount is more than this expense has left to refund",
    );
    expect(carriesFacts(error)).toBe(false);
  });

  test("a rejection naming a figure or date carries facts; others do not", () => {
    expect(
      carriesFacts(
        fieldError({
          pointer: "#/transactionDate",
          code: "after-refund",
          refundDate: "2026-09-03",
        }),
      ),
    ).toBe(true);
    expect(
      carriesFacts(fieldError({ pointer: "#/note", code: "note-too-long" })),
    ).toBe(false);
  });
});
