import {
  formatCalendarDate,
  parseCalendarDate,
} from "@bookkeeping/domain/dates";
import { WALLET_TYPES } from "@bookkeeping/domain/wallets";
import type { WalletEntryForm } from "@/features/wallets/hooks/use-wallet-entry-form";
import { WALLET_TYPE_LABELS } from "@/features/wallets/wallet-labels";
import { DatePicker } from "@/shared/components/date-picker";
import { AmountInput } from "@/shared/components/form/amount-input";
import { FieldErrors } from "@/shared/components/form/field-errors";
import { Button } from "@/shared/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";

// The fields of the wallet form, shared by its phone and desktop compositions.

const TYPE_OPTIONS = WALLET_TYPES.map((value) => ({
  value,
  label: WALLET_TYPE_LABELS[value],
}));

const SAVINGS_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
] as const;

function describeOpeningDate(value: string): string {
  const parsed = parseCalendarDate(value);
  if (!parsed.ok) {
    return "The balance above is what the wallet held at the start of this day.";
  }
  const date = formatCalendarDate(parsed.value).replaceAll(" ", "\u00A0");
  return `The balance above is what the wallet held at the start of ${date}. Tracking begins there.`;
}

interface WalletFieldProps {
  entryForm: WalletEntryForm;
}

export function WalletNameField({
  entryForm: { form, serverFieldErrors },
}: Readonly<WalletFieldProps>) {
  return (
    <form.Field name="name">
      {(field) => {
        const invalid =
          !field.state.meta.isValid || Boolean(serverFieldErrors.name);
        return (
          <Field data-invalid={invalid}>
            <FieldLabel htmlFor={field.name}>Name</FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              type="text"
              autoComplete="off"
              autoFocus
              placeholder="Kasikorn savings"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              aria-invalid={invalid}
            />
            <FieldErrors
              id={`${field.name}-error`}
              serverError={serverFieldErrors.name}
              errors={field.state.meta.errors}
            />
          </Field>
        );
      }}
    </form.Field>
  );
}

export function WalletTypeField({
  entryForm: { form, serverFieldErrors },
}: Readonly<WalletFieldProps>) {
  return (
    <form.Field name="type">
      {(field) => {
        const invalid =
          !field.state.meta.isValid || Boolean(serverFieldErrors.type);
        return (
          <Field data-invalid={invalid}>
            <FieldLabel id="wallet-type-label">Type</FieldLabel>
            <SegmentedControl
              name={field.name}
              aria-labelledby="wallet-type-label"
              options={TYPE_OPTIONS}
              value={field.state.value}
              onValueChange={field.handleChange}
              // "Bank account" needs the room on a 360px card.
              optionClassName="max-sm:px-0.5 max-sm:text-[0.8125rem]"
            />
            <FieldErrors
              id={`${field.name}-error`}
              serverError={serverFieldErrors.type}
              errors={field.state.meta.errors}
            />
          </Field>
        );
      }}
    </form.Field>
  );
}

export function WalletSavingsField({
  entryForm: { form, serverFieldErrors },
}: Readonly<WalletFieldProps>) {
  return (
    <form.Field name="savings">
      {(field) => {
        const invalid =
          !field.state.meta.isValid || Boolean(serverFieldErrors.savings);
        return (
          <Field data-invalid={invalid}>
            <FieldLabel id="wallet-savings-label">Savings wallet</FieldLabel>
            <SegmentedControl
              name={field.name}
              aria-labelledby="wallet-savings-label"
              aria-describedby="wallet-savings-description"
              options={SAVINGS_OPTIONS}
              value={field.state.value ? "on" : "off"}
              onValueChange={(value) => field.handleChange(value === "on")}
            />
            <FieldDescription id="wallet-savings-description">
              Its balance counts in Set aside instead of Spendable. You can
              still record against it.
            </FieldDescription>
            <FieldErrors
              id={`${field.name}-error`}
              serverError={serverFieldErrors.savings}
              errors={field.state.meta.errors}
            />
          </Field>
        );
      }}
    </form.Field>
  );
}

export function OpeningAmountField({
  entryForm: { form, serverFieldErrors },
}: Readonly<WalletFieldProps>) {
  return (
    <form.Field name="openingAmount">
      {(field) => {
        const invalid =
          !field.state.meta.isValid || Boolean(serverFieldErrors.openingAmount);
        return (
          <Field data-invalid={invalid}>
            <FieldLabel htmlFor={field.name}>Opening balance</FieldLabel>
            <AmountInput
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              aria-invalid={invalid}
              aria-describedby="opening-amount-description"
            />
            <FieldDescription id="opening-amount-description">
              In Thai baht, to the satang. A negative balance is allowed.
            </FieldDescription>
            <FieldErrors
              id={`${field.name}-error`}
              serverError={serverFieldErrors.openingAmount}
              errors={field.state.meta.errors}
            />
          </Field>
        );
      }}
    </form.Field>
  );
}

export function OpeningDateField({
  entryForm: { form, serverFieldErrors, today },
}: Readonly<WalletFieldProps>) {
  return (
    <form.Field name="openingDate">
      {(field) => {
        const invalid =
          !field.state.meta.isValid || Boolean(serverFieldErrors.openingDate);
        return (
          <Field data-invalid={invalid}>
            <FieldLabel htmlFor={field.name}>Opening date</FieldLabel>
            <DatePicker
              id={field.name}
              name={field.name}
              today={today}
              max={today}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              invalid={invalid}
              aria-describedby="opening-date-description"
            />
            <FieldDescription id="opening-date-description">
              {describeOpeningDate(field.state.value)}
            </FieldDescription>
            <FieldErrors
              id={`${field.name}-error`}
              serverError={serverFieldErrors.openingDate}
              errors={field.state.meta.errors}
            />
          </Field>
        );
      }}
    </form.Field>
  );
}

interface CreateWalletButtonProps extends WalletFieldProps {
  className?: string;
}

/** The submit button; each composition sizes it. */
export function CreateWalletButton({
  entryForm: { form },
  className,
}: Readonly<CreateWalletButtonProps>) {
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className={className}
        >
          {isSubmitting ? "Saving…" : "Create wallet"}
        </Button>
      )}
    </form.Subscribe>
  );
}
