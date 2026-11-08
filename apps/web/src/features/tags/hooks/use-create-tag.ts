import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import { useApiMutation } from "@/core/api/use-api-mutation";
import { refreshAfterWrite } from "@/core/query/refresh-after-write";
import {
  describeTagNameError,
  TAG_CONNECTION_MESSAGE,
} from "@/features/tags/tag-messages";

type Tag = components["schemas"]["Tag"];
type TagNameRequest = components["schemas"]["TagNameRequest"];

/**
 * Creates a tag from typed text without leaving the transaction. A retry
 * after a lost response replays the same key, so it never creates two.
 */
export function useCreateTag() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | undefined>();
  const createTag = useApiMutation<TagNameRequest, Tag>({
    send: (input, attempt) =>
      apiClient.POST("/v1/tags", {
        params: { header: attempt.header },
        body: input,
      }),
    describeFieldError: describeTagNameError,
  });

  /** The created tag, or undefined once the reason is in `error`. */
  async function create(name: string): Promise<Tag | undefined> {
    setError(undefined);
    let result: Awaited<ReturnType<typeof createTag.submit>>;
    try {
      result = await createTag.submit({ name });
    } catch {
      setError(TAG_CONNECTION_MESSAGE);
      return undefined;
    }
    if (!result.ok) {
      setError(result.error.message);
      return undefined;
    }
    await refreshAfterWrite(queryClient);
    return result.value;
  }

  return {
    create,
    error,
    clearError: () => setError(undefined),
    isPending: createTag.isPending,
  };
}
