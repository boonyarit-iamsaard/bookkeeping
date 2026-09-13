import { FieldError } from "@/shared/components/ui/field";

interface FieldErrorsProps {
  id: string;
  /** A definitive rejection from the server; it outranks stale local errors. */
  serverError: string | undefined;
  errors: Array<{ message?: string } | undefined>;
}

export function FieldErrors({
  id,
  serverError,
  errors,
}: Readonly<FieldErrorsProps>) {
  return serverError ? (
    <FieldError id={id}>{serverError}</FieldError>
  ) : (
    <FieldError id={id} errors={errors} />
  );
}
