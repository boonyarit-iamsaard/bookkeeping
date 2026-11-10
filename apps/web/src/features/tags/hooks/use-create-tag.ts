import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import { useFormWrites } from "@/core/api/use-form-writes";
import { describeTagNameError } from "@/features/tags/tag-messages";

type Tag = components["schemas"]["Tag"];
type TagNameRequest = components["schemas"]["TagNameRequest"];

interface UseCreateTagOptions {
  /** The success step, given the created tag once the reads refresh. */
  onCreated: (tag: Tag) => void;
}

/**
 * Creates a tag from typed text without leaving the transaction. A retry
 * after a lost response replays the same key, so it never creates two.
 */
export function useCreateTag({ onCreated }: Readonly<UseCreateTagOptions>) {
  // The picker shows no name field, so every refusal reads in the error bar.
  const { submit, pending, serverError, clearErrors } = useFormWrites({
    fields: [],
    writes: {
      create: {
        kind: "create",
        send: (input: TagNameRequest, attempt) =>
          apiClient.POST("/v1/tags", {
            params: { header: attempt.header },
            body: input,
          }),
        describeFieldError: describeTagNameError,
        onDone: onCreated,
      },
    },
  });

  return {
    create: (name: string) => submit("create", { name }),
    serverError,
    clearErrors,
    pending,
  };
}
