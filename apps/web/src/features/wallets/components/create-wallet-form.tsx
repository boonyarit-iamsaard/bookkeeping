import {
  formatCalendarDate,
  parseCalendarDate,
} from "@bookkeeping/domain/dates";
import { WALLET_TYPES } from "@bookkeeping/domain/wallets";
import { useStore } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useCreateWalletForm } from "@/features/wallets/hooks/use-create-wallet-form";
import { WALLET_TYPE_LABELS } from "@/features/wallets/wallet-labels";
import { DatePicker } from "@/shared/components/date-picker";
import { ErrorNotice } from "@/shared/components/error-notice";
import { AmountInput } from "@/shared/components/form/amount-input";
import type { EntryDialogHost } from "@/shared/components/form/entry-dialog";
import {
  EntryFormBody,
  EntrySaveBar,
  FormCard,
} from "@/shared/components/form/entry-form";
import { FieldErrors } from "@/shared/components/form/field-errors";
import { Button } from "@/shared/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";

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

interface CreateWalletFormProps {
  /** Set inside an entry dialog, which owns closing and the outcome of a save. */
  host?: EntryDialogHost;
}

export function CreateWalletForm({ host }: Readonly<CreateWalletFormProps>) {
  const navigate = useNavigate();
  const { form, today, serverError, serverFieldErrors } = useCreateWalletForm({
    onSaved: host?.onSaved,
  });
  const formRef = useRef<HTMLFormElement>(null);
  const hosted = Boolean(host);
  const dirty = useStore(form.store, (state) => state.isDirty);
  const onDirtyChange = host?.onDirtyChange;
  useEffect(() => onDirtyChange?.(dirty), [onDirtyChange, dirty]);

  useEffect(() => {
    const element = formRef.current;
    if (!element) {
      return;
    }
    const formElement = element;
    formElement.dataset.ready = "true";
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && event.target instanceof Node) {
        // A dialog closes on Escape itself and has no page to cancel to.
        if (hosted || !formElement.contains(event.target)) {
          return;
        }
        event.preventDefault();
        void navigate({ to: "/wallets" });
      }
    }
    formElement.addEventListener("keydown", handleEscape);
    return () => formElement.removeEventListener("keydown", handleEscape);
  }, [navigate, hosted]);

  return (
    <form
      ref={formRef}
      noValidate
      className="flex flex-col gap-6 in-data-entry-dialog:min-h-0 in-data-entry-dialog:flex-auto in-data-entry-dialog:gap-0 sm:gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <EntryFormBody>
        {serverError && <ErrorNotice>{serverError}</ErrorNotice>}

        <FormCard>
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

          <form.Field name="savings">
            {(field) => {
              const invalid =
                !field.state.meta.isValid || Boolean(serverFieldErrors.savings);
              return (
                <Field data-invalid={invalid}>
                  <FieldLabel id="wallet-savings-label">
                    Savings wallet
                  </FieldLabel>
                  <SegmentedControl
                    name={field.name}
                    aria-labelledby="wallet-savings-label"
                    aria-describedby="wallet-savings-description"
                    options={SAVINGS_OPTIONS}
                    value={field.state.value ? "on" : "off"}
                    onValueChange={(value) =>
                      field.handleChange(value === "on")
                    }
                  />
                  <FieldDescription id="wallet-savings-description">
                    Its balance counts in Set aside instead of Spendable. You
                    can still record against it.
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
        </FormCard>

        <FormCard>
          <form.Field name="openingAmount">
            {(field) => {
              const invalid =
                !field.state.meta.isValid ||
                Boolean(serverFieldErrors.openingAmount);
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

          <form.Field name="openingDate">
            {(field) => {
              const invalid =
                !field.state.meta.isValid ||
                Boolean(serverFieldErrors.openingDate);
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
        </FormCard>
      </EntryFormBody>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <EntrySaveBar>
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="h-12 w-full text-base"
            >
              {isSubmitting ? "Saving…" : "Create wallet"}
            </Button>
          </EntrySaveBar>
        )}
      </form.Subscribe>
    </form>
  );
}
