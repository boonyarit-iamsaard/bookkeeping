import { queryOptions } from "@tanstack/react-query";
import type { ClientPathsWithMethod } from "openapi-fetch";
import type { ApiClient } from "./client";
import { apiClient } from "./client";
import type { paths } from "./openapi.gen";
import type { ApiResponse } from "./problem";
import { ApiProblemError, readApiResponse } from "./problem";

type ReadPath = ClientPathsWithMethod<ApiClient, "get">;
type ReadParams<Path extends ReadPath> = paths[Path]["get"]["parameters"];

interface ReadQueryOptions<Path extends ReadPath, Output> {
  path: Path;
  params: ReadParams<Path>;
  /** The concrete client call; the generic one cannot be typed for every path. */
  read: (
    params: ReadParams<Path>,
    signal: AbortSignal,
  ) => Promise<ApiResponse<Output>>;
}

/**
 * Query options for one documented read. The key is the OpenAPI path and the
 * parameters, so cached reads are addressed exactly as the API is, and the
 * data keeps the server's response shape.
 */
function createReadQuery<Path extends ReadPath, Output>({
  path,
  params,
  read,
}: Readonly<ReadQueryOptions<Path, Output>>) {
  return queryOptions({
    queryKey: [path, params] as const,
    queryFn: async ({ signal }): Promise<Output> => {
      const outcome = readApiResponse(await read(params, signal));
      if (!outcome.ok) {
        throw new ApiProblemError(outcome.error);
      }
      return outcome.value;
    },
  });
}

type WalletListQuery = NonNullable<ReadParams<"/v1/wallets">["query"]>;
type TransactionListQuery = NonNullable<
  ReadParams<"/v1/transactions">["query"]
>;

export const walletQueries = {
  list(query?: WalletListQuery) {
    return createReadQuery({
      path: "/v1/wallets",
      params: { query },
      read: (params, signal) =>
        apiClient.GET("/v1/wallets", { params, signal }),
    });
  },
  detail(walletId: string) {
    return createReadQuery({
      path: "/v1/wallets/{walletId}",
      params: { path: { walletId } },
      read: (params, signal) =>
        apiClient.GET("/v1/wallets/{walletId}", { params, signal }),
    });
  },
};

export const categoryQueries = {
  list() {
    return createReadQuery({
      path: "/v1/categories",
      params: {},
      read: (params, signal) =>
        apiClient.GET("/v1/categories", { params, signal }),
    });
  },
  usage() {
    return createReadQuery({
      path: "/v1/categories/usage",
      params: {},
      read: (params, signal) =>
        apiClient.GET("/v1/categories/usage", { params, signal }),
    });
  },
  detail(categoryId: string) {
    return createReadQuery({
      path: "/v1/categories/{categoryId}",
      params: { path: { categoryId } },
      read: (params, signal) =>
        apiClient.GET("/v1/categories/{categoryId}", { params, signal }),
    });
  },
  detailUsage(categoryId: string) {
    return createReadQuery({
      path: "/v1/categories/{categoryId}/usage",
      params: { path: { categoryId } },
      read: (params, signal) =>
        apiClient.GET("/v1/categories/{categoryId}/usage", { params, signal }),
    });
  },
};

export const transactionQueries = {
  list(query?: TransactionListQuery) {
    return createReadQuery({
      path: "/v1/transactions",
      params: { query },
      read: (params, signal) =>
        apiClient.GET("/v1/transactions", { params, signal }),
    });
  },
  entryDefaults() {
    return createReadQuery({
      path: "/v1/transactions/entry-defaults",
      params: {},
      read: (params, signal) =>
        apiClient.GET("/v1/transactions/entry-defaults", { params, signal }),
    });
  },
  detail(transactionId: string) {
    return createReadQuery({
      path: "/v1/transactions/{transactionId}",
      params: { path: { transactionId } },
      read: (params, signal) =>
        apiClient.GET("/v1/transactions/{transactionId}", { params, signal }),
    });
  },
  refunds(transactionId: string) {
    return createReadQuery({
      path: "/v1/transactions/{transactionId}/refunds",
      params: { path: { transactionId } },
      read: (params, signal) =>
        apiClient.GET("/v1/transactions/{transactionId}/refunds", {
          params,
          signal,
        }),
    });
  },
};

export const reportQueries = {
  monthly(month: string) {
    return createReadQuery({
      path: "/v1/reports/monthly",
      params: { query: { month } },
      read: (params, signal) =>
        apiClient.GET("/v1/reports/monthly", { params, signal }),
    });
  },
};
