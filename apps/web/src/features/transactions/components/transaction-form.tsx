"use client";

import type { CalendarDate } from "@bookkeeping/domain/dates";
import { addDays } from "@bookkeeping/domain/dates";
import type { TransactionType } from "@bookkeeping/domain/transactions";
import {
  CREATABLE_TRANSACTION_TYPES,
  MAX_NOTE_LENGTH,
} from "@bookkeeping/domain/transactions";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDownUp, CircleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryPicker } from "@/features/categories/components/category-picker";
import { useCategoryCatalog } from "@/features/categories/hooks/use-category-catalog";
import { DeleteTransactionButton } from "@/features/transactions/components/delete-transaction-button";
import {
  DateChip,
  FixedLabel,
  FormCard,
  LinkedCategoryField,
  LinkedExpenseChip,
  SaveLabel,
  WalletSelect,
} from "@/features/transactions/components/transaction-form-fields";
import { TransactionTagsField } from "@/features/transactions/components/transaction-tags-field";
import { useTransactionForm } from "@/features/transactions/hooks/use-transaction-form";
import { refundAllowanceLabel } from "@/features/transactions/linked-expense";
import type {
  EditableTransaction,
  LinkedExpenseView,
  WalletOption,
} from "@/features/transactions/transaction.types";
import type { EntryMode } from "@/features/transactions/transaction-entry";
import { openEntry } from "@/features/transactions/transaction-entry";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { DatePicker } from "@/shared/components/date-picker";
import { AmountInput } from "@/shared/components/form/amount-input";
import { FieldErrors } from "@/shared/components/form/field-errors";
import { Button, linkActionClass } from "@/shared/components/ui/button";
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

function walletLabelFor(type: TransactionType) {
  if (type === "transfer") {
    return "From";
  }
  if (type === "refund") {
    return "Received in";
  }
  return "Wallet";
}

interface TransactionTypeFieldProps {
  fixedType: TransactionType | undefined;
  linked: LinkedExpenseView | undefined;
  editing: EditableTransaction | undefined;
  children: React.ReactNode;
}

function TransactionTypeField({
  fixedType,
  linked,
  editing,
  children,
}: Readonly<TransactionTypeFieldProps>) {
  if (linked) {
    return (
      <Field className="min-w-0">
        <FixedLabel>Type</FixedLabel>
        <p className="flex min-h-6 items-center font-semibold">Refund</p>
        <LinkedExpenseChip expense={linked} />
        <FieldDescription>
          {editing
            ? "The type and the linked expense are fixed once saved. To change them, delete this refund and record it again."
            : "Money returned for this expense. It reduces expenses rather than counting as income."}
        </FieldDescription>
      </Field>
    );
  }
  if (fixedType) {
    return (
      <Field>
        <FixedLabel>Type</FixedLabel>
        <p className="flex min-h-6 items-center font-semibold">
          {TRANSACTION_TYPE_LABELS[fixedType]}
        </p>
        <FieldDescription>
          The type is fixed once saved. To change it, delete this transaction
          and record it again.
        </FieldDescription>
      </Field>
    );
  }
  return children;
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
  const originalArchived =
    mode.kind === "refund" && mode.expense.wallet.archived;

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
                    {(field) => {
                      const serverFieldError = fieldErrors.walletId;
                      const invalid =
                        !field.state.meta.isValid || Boolean(serverFieldError);
                      return (
                        <Field data-invalid={invalid}>
                          <FieldLabel htmlFor={field.name}>
                            {walletLabelFor(type)}
                          </FieldLabel>
                          <div className="flex items-center gap-2">
                            <WalletSelect
                              id={field.name}
                              name={field.name}
                              wallets={wallets}
                              value={field.state.value}
                              placeholder={
                                type === "refund"
                                  ? "Choose an active wallet"
                                  : "Choose a wallet"
                              }
                              onBlur={field.handleBlur}
                              onValueChange={(next) => {
                                clearFieldError("walletId");
                                clearFieldError("transactionDate");
                                field.handleChange(next);
                              }}
                              aria-invalid={invalid}
                              aria-describedby={
                                [
                                  originalArchived && "walletId-description",
                                  invalid && `${field.name}-error`,
                                ]
                                  .filter(Boolean)
                                  .join(" ") || undefined
                              }
                            />
                            {type === "transfer" && (
                              <Button
                                type="button"
                                variant="outline"
                                className="h-11 w-11 shrink-0"
                                aria-label="Swap wallets"
                                onClick={() => {
                                  const from = form.getFieldValue("walletId");
                                  const to = form.getFieldValue(
                                    "destinationWalletId",
                                  );
                                  if (!from || !to) {
                                    return;
                                  }
                                  form.setFieldValue("walletId", to);
                                  form.setFieldValue(
                                    "destinationWalletId",
                                    from,
                                  );
                                  clearFieldError("walletId");
                                  clearFieldError("destinationWalletId");
                                  clearFieldError("transactionDate");
                                }}
                              >
                                <ArrowDownUp
                                  aria-hidden="true"
                                  strokeWidth={1.75}
                                />
                              </Button>
                            )}
                          </div>
                          {originalArchived && mode.kind === "refund" && (
                            <>
                              <FieldDescription id="walletId-description">
                                {mode.expense.wallet.name}, the expense’s
                                wallet, is archived. Choose an active wallet.
                              </FieldDescription>
                              <Link
                                to="/wallets/$walletId/manage"
                                params={{ walletId: mode.expense.wallet.id }}
                                className={linkActionClass}
                              >
                                Unarchive {mode.expense.wallet.name}
                              </Link>
                            </>
                          )}
                          <FieldErrors
                            id={`${field.name}-error`}
                            serverError={serverFieldError}
                            errors={field.state.meta.errors}
                          />
                        </Field>
                      );
                    }}
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
                        {(field) => {
                          const serverFieldError =
                            fieldErrors.destinationWalletId;
                          const invalid =
                            !field.state.meta.isValid ||
                            Boolean(serverFieldError);
                          return (
                            <Field data-invalid={invalid}>
                              <FieldLabel htmlFor={field.name}>To</FieldLabel>
                              <WalletSelect
                                id={field.name}
                                name={field.name}
                                wallets={wallets}
                                value={field.state.value ?? ""}
                                placeholder="Choose a destination wallet"
                                onBlur={field.handleBlur}
                                onValueChange={(next) => {
                                  clearFieldError("destinationWalletId");
                                  clearFieldError("transactionDate");
                                  field.handleChange(next);
                                }}
                                aria-invalid={invalid}
                                aria-describedby={
                                  invalid
                                    ? `${field.name}-error`
                                    : "transfer-description"
                                }
                              />
                              <FieldDescription
                                id="transfer-description"
                                className="text-[0.8125rem] leading-snug"
                              >
                                {wallets.length < 2
                                  ? "Transfers need two active wallets."
                                  : "Record any transfer fee as a separate expense."}
                              </FieldDescription>
                              {wallets.length < 2 && (
                                <Link
                                  to="/wallets/new"
                                  className={linkActionClass}
                                >
                                  Create another wallet
                                </Link>
                              )}
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
        {({ isSubmitting, type, amount, walletId, destinationWalletId }) => {
          const walletName = wallets.find(
            (wallet) => wallet.id === walletId,
          )?.name;
          const label = (
            <SaveLabel
              type={type}
              amountText={amount}
              walletName={walletName}
              destinationWalletName={
                wallets.find((wallet) => wallet.id === destinationWalletId)
                  ?.name
              }
            />
          );
          return (
            <div className="border-border bg-chrome/95 supports-backdrop-filter:bg-chrome/85 fixed inset-x-0 bottom-0 z-20 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <div className="mx-auto flex w-full max-w-md flex-col gap-3 sm:max-w-none">
                <Button
                  type="submit"
                  size="lg"
                  disabled={
                    pending ||
                    isSubmitting ||
                    (type === "transfer" && wallets.length < 2) ||
                    (type === "refund" && !walletId)
                  }
                  className={cn(
                    "min-h-12 w-full text-base",
                    type === "transfer" ? "h-auto" : "h-12",
                  )}
                >
                  {isSubmitting || pending ? "Saving…" : label}
                </Button>
              </div>
            </div>
          );
        }}
      </form.Subscribe>

      {editing && (
        <footer className="flex flex-col gap-6 border-t pt-6">
          <p className="text-muted-foreground text-sm leading-normal">
            Recorded {editing.recordedLabel} Bangkok time. Editing keeps this
            original recording time.
          </p>
          {editing.refundedLabel && (
            <p className="text-muted-foreground text-sm leading-normal">
              <span className="money" translate="no">
                {editing.refundedLabel}
              </span>{" "}
              of this expense has been refunded. The amount cannot go below
              that, the date cannot pass the earliest refund, and the expense
              cannot be deleted until its refunds are.
            </p>
          )}
          <DeleteTransactionButton
            transaction={editing}
            walletName={
              wallets.find((wallet) => wallet.id === editing.walletId)?.name
            }
            destinationWalletName={
              wallets.find(
                (wallet) => wallet.id === editing.destinationWalletId,
              )?.name
            }
            disabled={pending}
          />
        </footer>
      )}
    </form>
  );
}
