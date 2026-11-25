import type { CalendarDate } from "@bookkeeping/domain/dates";
import {
  CREATABLE_TRANSACTION_TYPES,
  MAX_NOTE_LENGTH,
} from "@bookkeeping/domain/transactions";
import { CircleAlert } from "lucide-react";
import { CategoryPicker } from "@/features/categories/components/category-picker";
import {
  DateChip,
  LinkedCategoryField,
  TransactionTypeField,
} from "@/features/transactions/components/transaction-form-fields";
import { TransactionTagsField } from "@/features/transactions/components/transaction-tags-field";
import {
  DestinationWalletField,
  SourceWalletField,
} from "@/features/transactions/components/transaction-wallet-fields";
import type { TransactionEntryForm } from "@/features/transactions/hooks/use-transaction-entry-form";
import { refundAllowanceLabel } from "@/features/transactions/linked-expense";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { DatePicker } from "@/shared/components/date-picker";
import { AmountInput } from "@/shared/components/form/amount-input";
import { FieldErrors } from "@/shared/components/form/field-errors";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { cn } from "@/shared/helpers/cn";

// The entry form's fields, one component each, wired to its form state. The
// phone and desktop compositions arrange them; neither redefines one.

const TYPE_OPTIONS = CREATABLE_TRANSACTION_TYPES.map((value) => ({
  value,
  label: TRANSACTION_TYPE_LABELS[value],
}));

interface SectionProps {
  entryForm: TransactionEntryForm;
}

interface BusySectionProps extends SectionProps {
  /** The form is saving, so the field cannot change. */
  busy: boolean;
}

interface FieldsetProps extends SectionProps {
  children: (busy: boolean) => React.ReactNode;
}

/** Locks every field while a save is in flight, and tells them so. */
export function TransactionFieldset({
  entryForm: { form, pending },
  children,
}: Readonly<FieldsetProps>) {
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <fieldset disabled={pending || isSubmitting} className="contents">
          {children(pending || isSubmitting)}
        </fieldset>
      )}
    </form.Subscribe>
  );
}

export function ServerErrorNotice({
  entryForm: { serverError },
}: Readonly<SectionProps>) {
  if (!serverError) {
    return null;
  }
  return (
    <div
      role="alert"
      className="bg-destructive/10 text-destructive flex items-start gap-3 rounded-2xl px-4 py-3 text-sm leading-normal"
    >
      <CircleAlert
        aria-hidden="true"
        strokeWidth={1.75}
        className="mt-0.5 size-4 shrink-0"
      />
      {serverError}
    </div>
  );
}

export function AmountSection({
  entryForm: { form, mode, editing, linked, fieldErrors, clearFieldError },
}: Readonly<SectionProps>) {
  return (
    <form.Field name="amount">
      {(field) => {
        const serverFieldError = fieldErrors.amount;
        const invalid = !field.state.meta.isValid || Boolean(serverFieldError);
        return (
          <Field data-invalid={invalid}>
            <FieldLabel htmlFor={field.name}>Amount</FieldLabel>
            <AmountInput
              id={field.name}
              name={field.name}
              autoFocus={!editing}
              onFocus={(event) => {
                if (mode.kind === "refund") {
                  event.currentTarget.select();
                }
              }}
              enterKeyHint="done"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => {
                clearFieldError("amount");
                field.handleChange(event.target.value);
              }}
              aria-invalid={invalid}
              aria-describedby={
                invalid
                  ? "amount-description amount-error"
                  : "amount-description"
              }
            />
            <FieldDescription id="amount-description">
              {linked ? (
                <>
                  Up to{" "}
                  <span className="money" translate="no">
                    {refundAllowanceLabel(linked)}
                  </span>{" "}
                  left to refund on this expense.
                </>
              ) : (
                "In Thai baht, to the satang."
              )}
            </FieldDescription>
            <FieldErrors
              id="amount-error"
              serverError={serverFieldError}
              errors={field.state.meta.errors}
            />
          </Field>
        );
      }}
    </form.Field>
  );
}

export function TypeSection({
  entryForm: { form, entry, linked, editing, changeType },
}: Readonly<SectionProps>) {
  return (
    <TransactionTypeField
      fixedType={entry.fixedType}
      linked={linked}
      editing={editing}
    >
      <form.Field name="type">
        {(field) => (
          <Field>
            <FieldLabel id="transaction-type-label">Type</FieldLabel>
            <SegmentedControl
              name={field.name}
              aria-labelledby="transaction-type-label"
              options={TYPE_OPTIONS}
              value={field.state.value}
              onValueChange={changeType}
            />
          </Field>
        )}
      </form.Field>
    </TransactionTypeField>
  );
}

export function SourceWalletSection({
  entryForm: {
    form,
    wallets,
    archivedWallet,
    fieldErrors,
    clearFieldError,
    swapWallets,
  },
}: Readonly<SectionProps>) {
  return (
    <form.Subscribe selector={(state) => state.values.type}>
      {(type) => (
        <form.Field name="walletId">
          {(field) => (
            <SourceWalletField
              name={field.name}
              wallets={wallets}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(next) => {
                clearFieldError("walletId");
                clearFieldError("transactionDate");
                field.handleChange(next);
              }}
              isValid={field.state.meta.isValid}
              errors={field.state.meta.errors}
              serverError={fieldErrors.walletId}
              type={type}
              archivedWallet={archivedWallet}
              onSwap={swapWallets}
            />
          )}
        </form.Field>
      )}
    </form.Subscribe>
  );
}

/** Category, a transfer's destination, or a refund's fixed category. */
export function CategorySection({
  entryForm: { form, wallets, linked, fieldErrors, clearFieldError },
  busy,
}: Readonly<BusySectionProps>) {
  return (
    <form.Subscribe selector={(state) => state.values.type}>
      {(type) => {
        if (linked) {
          return <LinkedCategoryField expense={linked} />;
        }
        if (type === "refund") {
          return null;
        }
        if (type === "transfer") {
          return (
            <form.Field name="destinationWalletId">
              {(field) => (
                <DestinationWalletField
                  name={field.name}
                  wallets={wallets}
                  value={field.state.value ?? ""}
                  onBlur={field.handleBlur}
                  onChange={(next) => {
                    clearFieldError("destinationWalletId");
                    clearFieldError("transactionDate");
                    field.handleChange(next);
                  }}
                  isValid={field.state.meta.isValid}
                  errors={field.state.meta.errors}
                  serverError={fieldErrors.destinationWalletId}
                />
              )}
            </form.Field>
          );
        }
        return (
          <form.Field name="categoryId">
            {(field) => {
              const serverFieldError = fieldErrors.categoryId;
              const invalid =
                !field.state.meta.isValid || Boolean(serverFieldError);
              return (
                <Field data-invalid={invalid}>
                  <FieldLabel id="categoryId-label" htmlFor={field.name}>
                    Category
                  </FieldLabel>
                  <CategoryPicker
                    key={type}
                    id={field.name}
                    kind={type}
                    value={field.state.value}
                    onSelect={(categoryId) => {
                      clearFieldError("categoryId");
                      field.handleChange(categoryId);
                    }}
                    aria-labelledby="categoryId-label"
                    aria-describedby={
                      invalid ? `${field.name}-error` : undefined
                    }
                    invalid={invalid}
                    disabled={busy}
                  />
                  <FieldErrors
                    id={`${field.name}-error`}
                    serverError={serverFieldError}
                    errors={field.state.meta.errors}
                  />
                </Field>
              );
            }}
          </form.Field>
        );
      }}
    </form.Subscribe>
  );
}

export function TagsSection({
  entryForm: { form, linked, fieldErrors, clearFieldError },
  busy,
}: Readonly<BusySectionProps>) {
  return (
    <form.Subscribe selector={(state) => state.values.type}>
      {(type) => (
        <form.Field name="tagIds">
          {(field) => (
            <TransactionTagsField
              type={type}
              linked={linked}
              value={field.state.value}
              onChange={(next) => {
                clearFieldError("tagIds");
                field.handleChange(next);
              }}
              serverError={fieldErrors.tagIds}
              disabled={busy}
            />
          )}
        </form.Field>
      )}
    </form.Subscribe>
  );
}

export function DateSection({
  entryForm: { form, linked, today, yesterday, fieldErrors, clearFieldError },
  busy,
}: Readonly<BusySectionProps>) {
  return (
    <form.Field name="transactionDate">
      {(field) => {
        const serverFieldError = fieldErrors.transactionDate;
        const invalid = !field.state.meta.isValid || Boolean(serverFieldError);
        function pick(date: CalendarDate) {
          clearFieldError("transactionDate");
          field.handleChange(date);
        }
        return (
          <Field data-invalid={invalid}>
            <FieldLabel htmlFor={field.name}>Date</FieldLabel>
            <DatePicker
              id={field.name}
              name={field.name}
              today={today}
              min={linked?.transactionDate}
              max={today}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={pick}
              invalid={invalid}
              aria-describedby={invalid ? `${field.name}-error` : undefined}
              disabled={busy}
            />
            <div className="flex gap-2">
              <DateChip
                selected={field.state.value === today}
                onClick={() => pick(today)}
              >
                Today
              </DateChip>
              <DateChip
                selected={field.state.value === yesterday}
                onClick={() => pick(yesterday)}
              >
                Yesterday
              </DateChip>
            </div>
            <FieldErrors
              id={`${field.name}-error`}
              serverError={serverFieldError}
              errors={field.state.meta.errors}
            />
          </Field>
        );
      }}
    </form.Field>
  );
}

export function NoteSection({
  entryForm: { form, fieldErrors, clearFieldError },
}: Readonly<SectionProps>) {
  return (
    <form.Field name="note">
      {(field) => {
        const serverFieldError = fieldErrors.note;
        const invalid = !field.state.meta.isValid || Boolean(serverFieldError);
        const remaining = MAX_NOTE_LENGTH - field.state.value.length;
        return (
          <Field data-invalid={invalid}>
            <FieldLabel htmlFor={field.name}>
              Note{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              type="text"
              autoComplete="off"
              placeholder="Weekly shop"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => {
                clearFieldError("note");
                field.handleChange(event.target.value);
              }}
              aria-invalid={invalid}
              aria-describedby={
                invalid ? "note-description note-error" : "note-description"
              }
              className="text-foreground h-11"
            />
            <FieldDescription
              id="note-description"
              className={cn(remaining < 0 && "text-destructive")}
            >
              {remaining < 0
                ? `${-remaining} over the ${MAX_NOTE_LENGTH}-character limit`
                : `${remaining} characters left`}
            </FieldDescription>
            <FieldErrors
              id="note-error"
              serverError={serverFieldError}
              errors={field.state.meta.errors}
            />
          </Field>
        );
      }}
    </form.Field>
  );
}
