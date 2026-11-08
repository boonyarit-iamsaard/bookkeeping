import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import { useApiMutation } from "@/core/api/use-api-mutation";
import { createFieldOf } from "@/core/api/write-submission";
import { refreshAfterWrite } from "@/core/query/refresh-after-write";
import {
  describeTagNameError,
  describeTagRejection,
  TAG_CONNECTION_MESSAGE,
} from "@/features/tags/tag-messages";
import type { TagSummary } from "@/features/tags/tag-search";

type Tag = components["schemas"]["Tag"];
type TagNameRequest = components["schemas"]["TagNameRequest"];

/** What the sheet finished with: the surviving tag, or the tag gone. */
export type EditTagOutcome =
  | { operation: "rename"; tag: Tag; merged: boolean }
  | { operation: "delete" };

interface UseEditTagFormOptions {
  tag: TagSummary;
  onDone: (outcome: EditTagOutcome) => void;
}

/**
 * Rename, which merges when the name is another tag's, and delete. The
 * list re-reads after either; neither touches any transaction's history.
 */
export function useEditTagForm({
  tag,
  onDone,
}: Readonly<UseEditTagFormOptions>) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(tag.name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | undefined>();
  const [deleting, startDeletion] = useTransition();
  const renameTag = useApiMutation<TagNameRequest, Tag>({
    send: (input) =>
      apiClient.PATCH("/v1/tags/{tagId}", {
        params: { path: { tagId: tag.id } },
        body: input,
      }),
    describeFieldError: describeTagNameError,
    fieldOf: createFieldOf(["name"]),
  });
  const deleteTag = useApiMutation<undefined, unknown>({
    send: () =>
      apiClient.DELETE("/v1/tags/{tagId}", {
        params: { path: { tagId: tag.id } },
      }),
  });

  async function save() {
    setServerError(undefined);
    setNameError(undefined);
    let result: Awaited<ReturnType<typeof renameTag.submit>>;
    try {
      result = await renameTag.submit({ name });
    } catch {
      setServerError(TAG_CONNECTION_MESSAGE);
      return;
    }
    if (!result.ok) {
      setNameError(result.error.fieldErrors.name);
      setServerError(describeTagRejection(result.error));
      return;
    }
    await refreshAfterWrite(queryClient);
    onDone({
      operation: "rename",
      tag: result.value,
      merged: result.value.id !== tag.id,
    });
  }

  function remove() {
    startDeletion(() => {
      void deleteTag
        .submit(undefined)
        .then(async (result) => {
          if (!result.ok) {
            setServerError(describeTagRejection(result.error));
            return;
          }
          await refreshAfterWrite(queryClient);
          onDone({ operation: "delete" });
        })
        .catch(() => setServerError(TAG_CONNECTION_MESSAGE));
    });
  }

  return {
    name,
    changeName(next: string) {
      setName(next);
      setNameError(undefined);
    },
    nameError,
    serverError,
    save,
    saving: renameTag.isPending,
    remove,
    deleting: deleting || deleteTag.isPending,
  };
}
