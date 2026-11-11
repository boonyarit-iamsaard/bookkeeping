import { walletRejectionProblemSchema } from "../../features/wallets/wallet-rejection.js";
import type { ContractExchange } from "../../testing/expect-documented-exchange.js";

interface WalletRequest {
  method: string;
  path: string;
  idempotencyKey?: string;
  body: unknown;
}

interface WalletRejectionExchangesOptions {
  call: (request: WalletRequest) => Promise<Response>;
  record: (exchange: ContractExchange) => Response;
  /** An open wallet whose opening the second exchange tries to replace. */
  walletId: string;
}

const FUTURE_DATE = "2999-01-01";

function money(value: string) {
  return { value, currency: "THB" };
}

/**
 * Records the 422 each wallet command answers when the application rejects
 * its input, so the contract test checks it against the published
 * field-error union.
 */
export async function recordWalletRejectionExchanges({
  call,
  record,
  walletId,
}: Readonly<WalletRejectionExchangesOptions>): Promise<void> {
  record({
    operationId: "createWallet",
    method: "post",
    path: "/v1/wallets",
    schema: walletRejectionProblemSchema,
    response: await call({
      method: "POST",
      path: "/v1/wallets",
      idempotencyKey: "wallet-rejected",
      body: {
        name: "   ",
        type: "cash",
        openingAmount: money("0.00"),
        openingDate: FUTURE_DATE,
      },
    }),
  });
  record({
    operationId: "replaceWalletOpening",
    method: "put",
    path: "/v1/wallets/{walletId}/opening",
    schema: walletRejectionProblemSchema,
    response: await call({
      method: "PUT",
      path: `/v1/wallets/${walletId}/opening`,
      body: { amount: money("0.00"), date: FUTURE_DATE },
    }),
  });
}
