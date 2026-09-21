import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { WriteOptions, WriteResult } from "./write-submission";
import { createWriteSubmission } from "./write-submission";

export interface UseApiMutationResult<Input, Output> {
  /**
   * Resolves to the API's verdict: the representation, or a rejection with
   * its field errors and message. Rejects only when the request was lost
   * twice, so a form reports the connection rather than the fields.
   */
  submit: (input: Input) => Promise<WriteResult<Output>>;
  /** True from submit until the verdict, including the replay. */
  isPending: boolean;
}

/**
 * The one way a form writes: a client-generated `Idempotency-Key` per
 * submit, a second submit joining the in-flight one, one same-key replay
 * when the response is lost, and a 422 mapped to field errors.
 */
export function useApiMutation<Input, Output>(
  options: Readonly<WriteOptions<Input, Output>>,
): UseApiMutationResult<Input, Output> {
  // The in-flight lock outlives renders; the options are read per submit.
  const [submission] = useState(() => createWriteSubmission<Input, Output>());
  const mutation = useMutation({
    mutationFn: (input: Input) => submission.submit(input, options),
  });

  return { submit: mutation.mutateAsync, isPending: mutation.isPending };
}
