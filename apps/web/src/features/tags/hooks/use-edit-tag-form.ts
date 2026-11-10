import { useState } from "react";
import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import { useFormWrites } from "@/core/api/use-form-writes";
import {
  describeTagNameError,
  describeTagRejection,
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
  const [name, setName] = useState(tag.name);
  const { submit, isPending, serverError, fieldErrors, clearFieldError } =
    useFormWrites({
      fields: ["name"],
      writes: {
        rename: {
          kind: "change",
          send: (input: TagNameRequest) =>
            apiClient.PATCH("/v1/tags/{tagId}", {
              params: { path: { tagId: tag.id } },
              body: input,
            }),
          describeFieldError: describeTagNameError,
          describeRejection: describeTagRejection,
          onDone: (renamed: Tag) =>
            onDone({
              operation: "rename",
              tag: renamed,
              merged: renamed.id !== tag.id,
            }),
        },
        remove: {
          kind: "delete",
          send: () =>
            apiClient.DELETE("/v1/tags/{tagId}", {
              params: { path: { tagId: tag.id } },
            }),
          describeRejection: describeTagRejection,
          onDone: () => onDone({ operation: "delete" }),
        },
      },
    });

  return {
    name,
    changeName(next: string) {
      setName(next);
      clearFieldError("name");
    },
    nameError: fieldErrors.name,
    serverError,
    save: () => submit.rename({ name }),
    saving: isPending("rename"),
    remove: () => submit.remove(),
    deleting: isPending("remove"),
  };
}
