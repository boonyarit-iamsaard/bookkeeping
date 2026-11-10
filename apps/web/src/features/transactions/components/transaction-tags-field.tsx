import type { TransactionType } from "@bookkeeping/domain/transactions";
import { carriesOwnTags } from "@bookkeeping/domain/transactions";
import { TagChipList } from "@/features/tags/components/tag-chip";
import { TagPicker } from "@/features/tags/components/tag-picker";
import { FixedLabel } from "@/features/transactions/components/transaction-form-fields";
import type { LinkedExpenseView } from "@/features/transactions/transaction.types";
import { FieldErrors } from "@/shared/components/form/field-errors";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/shared/components/ui/field";

interface TransactionTagsFieldProps {
  type: TransactionType;
  /** Set for a refund: its tags are the expense's, read back and never sent. */
  linked: LinkedExpenseView | undefined;
  value: readonly string[];
  onChange: (tagIds: string[]) => void;
  serverError: string | undefined;
  disabled: boolean;
}

/**
 * The Tags row, after Category: chosen on income and expense, read back
 * from the expense on a refund, and absent on a transfer, which carries
 * none. Always optional, so a transaction saves without any.
 */
export function TransactionTagsField({
  type,
  linked,
  value,
  onChange,
  serverError,
  disabled,
}: Readonly<TransactionTagsFieldProps>) {
  if (linked) {
    if (linked.tags.length === 0) {
      return null;
    }
    return (
      <Field>
        <FixedLabel>Tags</FixedLabel>
        <TagChipList tags={linked.tags} />
        <FieldDescription>
          Follows the expense’s tags, including later changes.
        </FieldDescription>
      </Field>
    );
  }
  if (!carriesOwnTags({ type })) {
    return null;
  }
  return (
    <Field data-invalid={Boolean(serverError)}>
      <FieldLabel id="tagIds-label" htmlFor="tagIds">
        Tags{" "}
        <span className="text-muted-foreground font-normal">(optional)</span>
      </FieldLabel>
      <TagPicker
        id="tagIds"
        value={value}
        onChange={onChange}
        aria-labelledby="tagIds-label"
        aria-describedby={serverError ? "tagIds-error" : undefined}
        invalid={Boolean(serverError)}
        disabled={disabled}
      />
      <FieldErrors id="tagIds-error" serverError={serverError} errors={[]} />
    </Field>
  );
}
