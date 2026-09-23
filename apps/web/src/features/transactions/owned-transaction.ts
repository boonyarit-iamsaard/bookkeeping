import type { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import type { components } from "@/core/api/openapi.gen";
import { ApiProblemError } from "@/core/api/problem";
import { transactionQueries } from "@/core/api/queries";

const NOT_FOUND_STATUS = 404;

type Transaction = components["schemas"]["Transaction"];

/**
 * The signed-in user's transaction, from the cache or the API, for a route
 * loader. Ownership is part of the lookup: another user's id and a deleted
 * transaction both throw the router's not found.
 */
export async function loadOwnedTransaction(
  queryClient: QueryClient,
  transactionId: string,
): Promise<Transaction> {
  let transaction: Transaction | undefined;
  try {
    transaction = await queryClient.ensureQueryData(
      transactionQueries.detail(transactionId),
    );
  } catch (error) {
    if (
      error instanceof ApiProblemError &&
      error.problem.status === NOT_FOUND_STATUS
    ) {
      throw notFound();
    }
    throw error;
  }
  if (!transaction) {
    throw new Error("The transaction query returned no data");
  }
  return transaction;
}
