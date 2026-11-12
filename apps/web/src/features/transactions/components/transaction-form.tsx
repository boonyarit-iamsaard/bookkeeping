"use client";

import type { CalendarDate } from "@bookkeeping/domain/dates";
import { addDays } from "@bookkeeping/domain/dates";
import {
  CREATABLE_TRANSACTION_TYPES,
  MAX_NOTE_LENGTH,
} from "@bookkeeping/domain/transactions";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryPicker } from "@/features/categories/components/category-picker";
import { useCategoryCatalog } from "@/features/categories/hooks/use-category-catalog";
import {
  TransactionEditFooter,
  TransactionSaveBar,
} from "@/features/transactions/components/transaction-form-actions";
import {
  DateChip,
  FormCard,
  LinkedCategoryField,
  TransactionTypeField,
} from "@/features/transactions/components/transaction-form-fields";
import { TransactionTagsField } from "@/features/transactions/components/transaction-tags-field";
import {
  DestinationWalletField,
  SourceWalletField,
} from "@/features/transactions/components/transaction-wallet-fields";
import { useTransactionForm } from "@/features/transactions/hooks/use-transaction-form";
import { refundAllowanceLabel } from "@/features/transactions/linked-expense";
import type { WalletOption } from "@/features/transactions/transaction.types";
import type { EntryMode } from "@/features/transactions/transaction-entry";
import { openEntry } from "@/features/transactions/transaction-entry";
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
import { useToday } from "@/shared/hooks/use-today";

const TYPE_OPTIONS = CREATABLE_TRANSACTION_TYPES.map((value) => ({
  value,
  label: TRANSACTION_TYPE_LABELS[value],
}));

interface TransactionFormProps {
  wallets: readonly WalletOption[];
  mode: EntryMode;
}

export function TransactionForm({
  wallets,
  mode,
}: Readonly<TransactionFormProps>) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const { categories } = useCategoryCatalog();
  const today = useToday();
  const [openedOn] = useState(today);
  const entry = useMemo(
    () => openEntry({ mode, categories, today: openedOn }),
    [mode, categories, openedOn],
  );
  const { correcting: editing, linkedExpense: linked, cancelHref } = entry;
  const archivedWallet =
    mode.kind === "refund" && mode.expense.wallet.archived
      ? mode.expense.wallet
      : undefined;

  useEffect(() => {
    const element = formRef.current;
    if (!element) {
      return;
    }
    const formElement = element;
    function cancelOnEscape(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        event.target instanceof Node &&
        formElement.contains(event.target)
      ) {
        event.preventDefault();
        void navigate({ href: cancelHref });
      }
    }
    document.addEventListener("keydown", cancelOnEscape);
    return () => document.removeEventListener("keydown", cancelOnEscape);
  }, [navigate, cancelHref]);

  const {
    form,
    serverError,
    fieldErrors,
    clearFieldError,
    changeType,
    pending,
  } = useTransactionForm({ entry, wallets, categories, today });
  const yesterday = addDays(today, -1);

  function swapWallets() {
    const from = form.getFieldValue("walletId");
    const to = form.getFieldValue("destinationWalletId");
    if (!from || !to) {
      return;
    }
    form.setFieldValue("walletId", to);
    form.setFieldValue("destinationWalletId", from);
    clearFieldError("walletId");
    clearFieldError("destinationWalletId");
    clearFieldError("transactionDate");
  }

  return (
    <form
      ref={formRef}
      noValidate
      className="flex flex-col gap-6 sm:gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      {serverError && (
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
      )}

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <fieldset disabled={pending || isSubmitting} className="contents">
            <FormCard>
              <form.Field name="amount">
                {(field) => {
                  const serverFieldError = fieldErrors.amount;
                  const invalid =
                    !field.state.meta.isValid || Boolean(serverFieldError);
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
            </FormCard>

            <FormCard>
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
                          !field.state.meta.isValid ||
                          Boolean(serverFieldError);
                        return (
                          <Field data-invalid={invalid}>
                            <FieldLabel
                              id="categoryId-label"
                              htmlFor={field.name}
                            >
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
                              disabled={pending || isSubmitting}
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
                        disabled={pending || isSubmitting}
                      />
                    )}
                  </form.Field>
                )}
              </form.Subscribe>

              <form.Field name="transactionDate">
                {(field) => {
                  const serverFieldError = fieldErrors.transactionDate;
                  const invalid =
                    !field.state.meta.isValid || Boolean(serverFieldError);
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
                        aria-describedby={
                          invalid ? `${field.name}-error` : undefined
                        }
                        disabled={pending || isSubmitting}
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

              <form.Field name="note">
                {(field) => {
                  const serverFieldError = fieldErrors.note;
                  const invalid =
                    !field.state.meta.isValid || Boolean(serverFieldError);
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
                          invalid
                            ? "note-description note-error"
                            : "note-description"
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
            </FormCard>
          </fieldset>
        )}
      </form.Subscribe>

      <form.Subscribe
        selector={(state) => ({
          isSubmitting: state.isSubmitting,
          type: state.values.type,
          amount: state.values.amount,
          walletId: state.values.walletId,
          destinationWalletId: state.values.destinationWalletId,
        })}
      >
        {(state) => (
          <TransactionSaveBar wallets={wallets} pending={pending} {...state} />
        )}
      </form.Subscribe>

      {editing && (
        <TransactionEditFooter
          transaction={editing}
          wallets={wallets}
          pending={pending}
        />
      )}
    </form>
  );
}
