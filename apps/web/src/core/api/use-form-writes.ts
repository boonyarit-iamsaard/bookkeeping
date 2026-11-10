import { useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState } from "react";
import {
  forgetReads,
  refreshAfterWrite,
} from "@/core/query/refresh-after-write";
import type { FormSubmits, FormWriteSet, FormWritesState } from "./form-writes";
import { createFormWrites } from "./form-writes";

interface UseFormWritesOptions<Field extends string, Writes> {
  /** The fields the form shows; an error for any other joins the error bar. */
  fields: readonly Field[];
  /** The form's named writes, a fixed set; their options are read per submit. */
  writes: Writes;
}

export interface UseFormWritesResult<Field extends string, Writes> {
  /** Settles a named write; a submit while it is in flight joins it. */
  submit: FormSubmits<Writes>;
  /** True from any submit until its outcome, including the replay. */
  pending: boolean;
  /** True while the named write is in flight, to label its own button. */
  isPending: (name: keyof Writes) => boolean;
  serverError: string | undefined;
  fieldErrors: Partial<Record<Field, string>>;
  clearFieldError: (field: Field) => void;
  clearErrors: () => void;
}

/**
 * The one way a form writes. The form declares its fields and named writes;
 * the core settles each one, refreshing the cached reads after a success and
 * forgetting a deleted record's reads after the success step.
 */
export function useFormWrites<
  Field extends string,
  Writes extends FormWriteSet<Writes>,
>({
  fields,
  writes,
}: Readonly<UseFormWritesOptions<Field, Writes>>): UseFormWritesResult<
  Field,
  Writes
> {
  const queryClient = useQueryClient();
  const latest = useRef(writes);
  useLayoutEffect(() => {
    latest.current = writes;
  });
  const [state, setState] = useState<
    Readonly<FormWritesState<Field, keyof Writes>>
  >({ pending: false, running: [], serverError: undefined, fieldErrors: {} });
  // The core holds the in-flight writes, so it outlives renders.
  const [core] = useState(() =>
    createFormWrites<Field, Writes>({
      fields,
      writes: () => latest.current,
      refresh: (retired) => refreshAfterWrite(queryClient, { retired }),
      forget: (retired) => forgetReads(queryClient, retired),
      onStateChange: setState,
    }),
  );

  return {
    submit: core.submit,
    pending: state.pending,
    isPending: (name) => state.running.includes(name),
    serverError: state.serverError,
    fieldErrors: state.fieldErrors,
    clearFieldError: core.clearFieldError,
    clearErrors: core.clearErrors,
  };
}
