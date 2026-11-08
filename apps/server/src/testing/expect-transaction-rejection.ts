import { transactionRejectionProblemSchema } from "../features/transactions/transaction-rejection.js";
import { expectProblem } from "./expect-problem.js";

/** Asserts a rejected transaction command and returns its field errors with their facts. */
export async function expectRejection(response: Response) {
  await expectProblem(response.clone(), {
    status: 422,
    code: "invalid-command",
  });
  return transactionRejectionProblemSchema.parse(await response.json()).errors;
}
