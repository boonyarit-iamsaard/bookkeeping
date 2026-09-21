import type { CalendarDate } from "@bookkeeping/domain/dates";
import {
  formatCalendarDate,
  parseCalendarDate,
} from "@bookkeeping/domain/dates";
import { WALLET_TYPES } from "@bookkeeping/domain/wallets";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useCreateWalletForm } from "@/features/wallets/hooks/use-create-wallet-form";
import { WALLET_TYPE_LABELS } from "@/features/wallets/wallet-labels";
import { DatePicker } from "@/shared/components/date-picker";
import { FieldErrors } from "@/shared/components/form/field-errors";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";

const TYPE_OPTIONS = WALLET_TYPES.map((value) => ({
  value,
  label: WALLET_TYPE_LABELS[value],
}));

function describeOpeningDate(value: string): string {
  const parsed = parseCalendarDate(value);
  if (!parsed.ok) {
    return "The balance above is what the wallet held at the start of this day.";
  }
  const date = formatCalendarDate(parsed.value).replaceAll(" ", "\u00A0");
  return `The balance above is what the wallet held at the start of ${date}. Tracking begins there.`;
}

interface CreateWalletFormProps {
  /** Today in Asia/Bangkok, computed by the route. */
  defaultOpeningDate: CalendarDate;
}

export function CreateWalletForm({
  defaultOpeningDate,
}: Readonly<CreateWalletFormProps>) {
  const navigate = useNavigate();
  const { form, serverError, serverFieldErrors } = useCreateWalletForm({
    defaultOpeningDate,
  });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const element = formRef.current;
    if (!element) {
      return;
    }
    const formElement = element;
    formElement.dataset.ready = "true";
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && event.target instanceof Node) {
        if (!formElement.contains(event.target)) {
          return;
        }
        event.preventDefault();
        void navigate({ to: "/wallets" });
      }
    }
    formElement.addEventListener("keydown", handleEscape);
    return () => formElement.removeEventListener("keydown", handleEscape);
  }, [navigate]);

  return (
    <form
      ref={formRef}
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      {serverError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm"
        >
          {serverError}
        </div>
      )}

      <FieldGroup>
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

        <form.Field name="openingAmount">
          {(field) => {
            const invalid =
              !field.state.meta.isValid ||
              Boolean(serverFieldErrors.openingAmount);
            return (
              <Field data-invalid={invalid}>
                <FieldLabel htmlFor={field.name}>Opening balance</FieldLabel>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted-foreground"
                  >
                    ฿
                  </span>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={invalid}
                    aria-describedby="opening-amount-description"
                    className="money h-12 pr-16 pl-9 text-foreground text-lg md:text-lg"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-medium text-muted-foreground text-sm"
                  >
                    THB
                  </span>
                </div>
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
                  today={defaultOpeningDate}
                  max={defaultOpeningDate}
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
      </FieldGroup>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/80 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="mx-auto flex w-full max-w-md flex-col gap-3 sm:max-w-none">
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="h-12 w-full text-base"
              >
                {isSubmitting ? "Saving…" : "Create wallet"}
              </Button>
              <Link
                to="/wallets"
                className={buttonVariants({
                  variant: "ghost",
                  size: "lg",
                  className: "h-11 w-full sm:hidden",
                })}
              >
                Cancel
              </Link>
            </div>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
