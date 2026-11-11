import type { DeclaredWrite } from "@/core/api/form-writes";
import type { components } from "@/core/api/openapi.gen";
import {
  createBlockerDescriber,
  createFieldErrorDescriber,
} from "@/core/api/rejection-wording";

/** Every reason the API refuses a wallet input, as it publishes them. */
export type WalletRejectionCode =
  components["schemas"]["WalletRuleFieldError"]["code"];

/** Every reason the API blocks a wallet write, as it publishes them. */
export type WalletBlockerCode =
  components["schemas"]["HistoryRemainsProblem"]["code"];

// Keyed by every published code, so a new or renamed one fails to compile
// until it has a message.
const WALLET_FIELD_MESSAGES: Record<WalletRejectionCode, string> = {
  empty: "Enter a wallet name",
  "out-of-range": "That amount is larger than the app can store",
  invalid: "Enter a real calendar date",
  "in-future": "Opening date cannot be in the future",
  "movement-before-opening":
    "Opening date cannot be after an existing movement, including retained deleted entries. Choose an earlier date.",
};

const WALLET_BLOCKER_MESSAGES: Record<WalletBlockerCode, string> = {
  "history-remains":
    "This wallet has retained transaction or change history and cannot be deleted. Archive it to remove it from entry pickers.",
};

/** The message beside a refused wallet input, in the product's words. */
export const describeWalletFieldError = createFieldErrorDescriber(
  WALLET_FIELD_MESSAGES,
);

/** The error-bar message for a refused wallet write. */
export const describeWalletRejection = createBlockerDescriber(
  WALLET_BLOCKER_MESSAGES,
);

/** How every wallet write reads a refusal. These writes show no fields, so a field error arrives as the message. */
export const WALLET_REFUSAL_WORDING = {
  describeFieldError: describeWalletFieldError,
  describeRejection: describeWalletRejection,
} satisfies Pick<DeclaredWrite, "describeFieldError" | "describeRejection">;
