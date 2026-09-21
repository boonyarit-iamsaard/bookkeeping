"use client";

import type { CalendarDate } from "@bookkeeping/domain/dates";
import { addDays, formatCalendarDate } from "@bookkeeping/domain/dates";
import { formatMoney, parseMoneyInput } from "@bookkeeping/domain/money";
import type { TransactionType } from "@bookkeeping/domain/transactions";
import {
  CREATABLE_TRANSACTION_TYPES,
  MAX_NOTE_LENGTH,
} from "@bookkeeping/domain/transactions";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDownUp, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CreateCategoryOutcome } from "@/features/categories/category-mutations";
import { CategoryIcon } from "@/features/categories/components/category-icon";
import { CategoryPicker } from "@/features/categories/components/category-picker";
import { DeleteTransactionButton } from "@/features/transactions/components/delete-transaction-button";
import { useBangkokToday } from "@/features/transactions/hooks/use-bangkok-today";
import type {
  CategoryOption,
  WalletOption,
} from "@/features/transactions/hooks/use-transaction-form";
import {
  uncategorizedFor,
  useTransactionForm,
} from "@/features/transactions/hooks/use-transaction-form";
import type { LinkedExpenseView } from "@/features/transactions/transaction.types";
import type {
  ExpenseRefundLimits,
  LinkedExpenseLimits,
  TransactionFormInput,
} from "@/features/transactions/transaction-form-schema";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_SIGNS,
} from "@/features/transactions/transaction-labels";
import { WalletTypeIcon } from "@/features/wallets/components/wallet-type-icon";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/helpers/cn";

const TYPE_OPTIONS = CREATABLE_TRANSACTION_TYPES.map((value) => ({
  value,
  label: TRANSACTION_TYPE_LABELS[value],
}));

/** An existing transaction as the edit form loads it. */
export interface EditableTransaction {
  id: string;
  type: TransactionType;
  walletId: string;
  categoryId: string;
  destinationWalletId: string;
  /** The stored amount in baht text, e.g. "120.00", exactly as saved. */
  amountText: string;
  transactionDate: CalendarDate;
  note: string;
  /** "13 Sep 2026, 14:32", already in Bangkok time. */
  recordedLabel: string;
  /** Set when the transaction is a refund. */
  refundOf?: LinkedExpenseView;
  /** For an expense: what its linked refunds add up to, if any. */
  refundedLabel?: string;
  /** For an expense with refunds: the limits the API's rejections name. */
  expenseRefunds?: ExpenseRefundLimits;
}

export type TransactionFormMode =
  | { kind: "create"; defaultWalletId: string }
  /** A new refund of one expense; the wallet is unset when the original is archived. */
  | { kind: "refund"; expense: LinkedExpenseView; defaultWalletId: string }
  | { kind: "edit"; transaction: EditableTransaction };

interface TransactionFormProps {
  wallets: readonly WalletOption[];
  categories: readonly CategoryOption[];
  /** Today in Asia/Bangkok, computed by the route. */
  today: CalendarDate;
  mode: TransactionFormMode;
}

interface InitialValuesOptions {
  mode: TransactionFormMode;
  categories: readonly CategoryOption[];
  today: CalendarDate;
}

function initialValuesFor({
  mode,
  categories,
  today,
}: Readonly<InitialValuesOptions>): TransactionFormInput {
  if (mode.kind === "edit") {
    const { transaction } = mode;
    return {
      type: transaction.type,
      currency: "THB",
      destinationWalletId: transaction.destinationWalletId,
      refundOfTransactionId: transaction.refundOf?.id ?? "",
      walletId: transaction.walletId,
      categoryId: transaction.categoryId,
      amount: transaction.amountText,
      transactionDate: transaction.transactionDate,
      note: transaction.note,
    };
  }
  if (mode.kind === "refund") {
    return {
      type: "refund",
      currency: "THB",
      destinationWalletId: "",
      refundOfTransactionId: mode.expense.id,
      walletId: mode.defaultWalletId,
      categoryId: "",
      amount: mode.expense.remainingText,
      transactionDate: today,
      note: "",
    };
  }
  return {
    type: "expense",
    currency: "THB",
    destinationWalletId: "",
    refundOfTransactionId: "",
    walletId: mode.defaultWalletId,
    categoryId: uncategorizedFor(categories, "expense"),
    amount: "",
    transactionDate: today,
    note: "",
  };
}

/** The limits the schema checks inline for a linked refund. */
function limitsOf(
  linked: Readonly<LinkedExpenseView> | undefined,
): LinkedExpenseLimits | undefined {
  if (!linked) {
    return undefined;
  }
  const remaining = parseMoneyInput({
    text: linked.remainingText,
    currency: "THB",
  });
  return {
    transactionDate: linked.transactionDate,
    remaining: remaining.ok ? remaining.value : 0n,
  };
}

interface SaveLabelProps {
  type: TransactionType;
  amountText: string;
  walletName: string | undefined;
  destinationWalletName?: string;
}

/** "Save −฿120.00 · Cash" once the amount parses; plain "Save" before that. */
function SaveLabel({
  type,
  amountText,
  walletName,
  destinationWalletName,
}: Readonly<SaveLabelProps>) {
  const parsed = parseMoneyInput({ text: amountText, currency: "THB" });
  if (!parsed.ok || parsed.value <= 0n || !walletName) {
    return "Save";
  }
  const figure = formatMoney({
    amountInMinorUnits: parsed.value,
    currency: "THB",
  });
  if (type === "transfer" && destinationWalletName) {
    return (
      <span className="flex min-w-0 flex-col items-center gap-1 py-2">
        <span>
          Save{" "}
          <span className="money" translate="no">
            {figure}
          </span>
        </span>
        <span className="wrap-break-word w-full whitespace-normal font-normal text-sm">
          {walletName} → {destinationWalletName}
        </span>
      </span>
    );
  }
  return (
    <>
      Save{" "}
      <span className="money" translate="no">
        {TRANSACTION_TYPE_SIGNS[type]}
        {figure}
      </span>{" "}
      · {walletName}
    </>
  );
}

interface FixedLabelProps {
  children: React.ReactNode;
}

function FixedLabel({ children }: Readonly<FixedLabelProps>) {
  return (
    <span
      data-slot="field-label"
      className="flex select-none items-center gap-2 font-medium text-sm leading-none"
    >
      {children}
    </span>
  );
}

interface LinkedExpenseChipProps {
  expense: LinkedExpenseView;
}

/** The refunded expense read back: category, date, amount, and what is left. */
function LinkedExpenseChip({ expense }: Readonly<LinkedExpenseChipProps>) {
  return (
    <Link
      to="/transactions/$transactionId"
      params={{ transactionId: expense.id }}
      aria-label={`Refund of ${expense.categoryLabel}, ${expense.amountLabel} on ${formatCalendarDate(expense.transactionDate)}, ${expense.remainingLabel} left to refund. Open the expense.`}
      className="flex min-h-14 min-w-0 items-center gap-3 rounded-xl border px-3 py-2 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <CategoryIcon iconId={expense.categoryIconId} className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="block truncate font-medium text-sm leading-snug">
          <span className="text-muted-foreground">Refund of</span>{" "}
          {expense.categoryLabel}
        </span>
        <span className="wrap-break-word block text-muted-foreground text-sm">
          <span className="money" translate="no">
            −{expense.amountLabel}
          </span>{" "}
          · {formatCalendarDate(expense.transactionDate)} ·{" "}
          <span className="whitespace-nowrap">
            <span className="money" translate="no">
              {expense.remainingLabel}
            </span>{" "}
            left
          </span>
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        strokeWidth={1.75}
        className="size-4 shrink-0 text-muted-foreground"
      />
    </Link>
  );
}

function cancelHrefFor(mode: Readonly<TransactionFormMode>) {
  if (mode.kind === "edit") {
    return `/transactions/${mode.transaction.id}`;
  }
  if (mode.kind === "refund") {
    return `/transactions/${mode.expense.id}`;
  }
  return "/transactions";
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
  linked: LinkedExpenseView | undefined;
  editing: EditableTransaction | undefined;
  children: React.ReactNode;
}

function TransactionTypeField({
  linked,
  editing,
  children,
}: Readonly<TransactionTypeFieldProps>) {
  if (linked) {
    return (
      <Field className="min-w-0">
        <FixedLabel>Type</FixedLabel>
        <p className="flex h-11 items-center font-medium">Refund</p>
        <LinkedExpenseChip expense={linked} />
        <FieldDescription>
          {editing
            ? "The type and the linked expense are fixed once saved. To change them, delete this refund and record it again."
            : "Money returned for this expense. It reduces expenses rather than counting as income."}
        </FieldDescription>
      </Field>
    );
  }
  if (editing) {
    return (
      <Field>
        <FixedLabel>Type</FixedLabel>
        <p className="flex h-11 items-center font-medium">
          {TRANSACTION_TYPE_LABELS[editing.type]}
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
  categories: initialCategories,
  today: initialToday,
  mode,
}: Readonly<TransactionFormProps>) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const editing = mode.kind === "edit" ? mode.transaction : undefined;
  const linked = mode.kind === "refund" ? mode.expense : editing?.refundOf;
  const linkedExpense = useMemo(() => limitsOf(linked), [linked]);
  const cancelHref = cancelHrefFor(mode);
  const originalArchived =
    mode.kind === "refund" && mode.expense.wallet.archived;
  const [categories, setCategories] = useState(initialCategories);

  function addCategories({
    category,
    createdParent,
  }: Readonly<CreateCategoryOutcome>) {
    setCategories((current) => [
      ...current,
      ...(createdParent ? [createdParent] : []),
      category,
    ]);
  }

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
        void navigate({ to: cancelHref });
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
    isPending,
  } = useTransactionForm({
    wallets,
    categories,
    initialValues: initialValuesFor({
      mode,
      categories,
      today: initialToday,
    }),
    linkedExpense,
    expenseRefunds: editing?.expenseRefunds,
    editingId: editing?.id,
  });
  const today = useBangkokToday(initialToday);
  const yesterday = addDays(today, -1);

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

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <fieldset disabled={isPending || isSubmitting} className="contents">
            <FieldGroup>
              <form.Field name="amount">
                {(field) => {
                  const serverFieldError = fieldErrors.amount;
                  const invalid =
                    !field.state.meta.isValid || Boolean(serverFieldError);
                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor={field.name}>Amount</FieldLabel>
                      <div className="relative">
                        <span
                          aria-hidden="true"
                          className="money pointer-events-none absolute inset-y-0 left-5 flex items-center text-muted-foreground text-xl"
                        >
                          ฿
                        </span>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          autoFocus={!editing}
                          onFocus={(event) => {
                            if (mode.kind === "refund") {
                              event.currentTarget.select();
                            }
                          }}
                          enterKeyHint="done"
                          placeholder="0.00"
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
                          className="money h-16 pr-16 pl-11 text-3xl text-foreground md:text-3xl"
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 right-5 flex items-center font-medium text-muted-foreground text-sm"
                        >
                          THB
                        </span>
                      </div>
                      <FieldDescription id="amount-description">
                        {linked ? (
                          <>
                            Up to{" "}
                            <span className="money" translate="no">
                              {linked.remainingLabel}
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

              <TransactionTypeField linked={linked} editing={editing}>
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
                            <FieldDescription id="walletId-description">
                              {mode.expense.wallet.name}, the expense’s wallet,
                              is archived. Choose an active wallet, or{" "}
                              <Link
                                to="/wallets/$walletId"
                                params={{ walletId: mode.expense.wallet.id }}
                                className="underline underline-offset-4"
                              >
                                unarchive {mode.expense.wallet.name}
                              </Link>
                              .
                            </FieldDescription>
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
                    return (
                      <Field>
                        <FixedLabel>Category</FixedLabel>
                        <p className="flex min-h-11 items-center gap-3 font-medium">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                            <CategoryIcon
                              iconId={linked.categoryIconId}
                              className="size-4"
                            />
                          </span>
                          {linked.categoryLabel}
                        </p>
                        <FieldDescription>
                          Follows the expense’s category, including later
                          changes.
                        </FieldDescription>
                      </Field>
                    );
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
                              <FieldDescription id="transfer-description">
                                {wallets.length < 2 ? (
                                  <>
                                    Transfers need two active wallets.{" "}
                                    <Link
                                      to="/wallets/new"
                                      className="underline underline-offset-4"
                                    >
                                      Create another wallet
                                    </Link>
                                    .
                                  </>
                                ) : (
                                  "Record any transfer fee as a separate expense."
                                )}
                              </FieldDescription>
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
                              id={field.name}
                              kind={type}
                              categories={categories}
                              value={field.state.value}
                              onSelect={(categoryId) => {
                                clearFieldError("categoryId");
                                field.handleChange(categoryId);
                              }}
                              onCreated={(outcome) => {
                                clearFieldError("categoryId");
                                addCategories(outcome);
                                field.handleChange(outcome.category.id);
                              }}
                              aria-labelledby="categoryId-label"
                              aria-describedby={
                                invalid ? `${field.name}-error` : undefined
                              }
                              invalid={invalid}
                              disabled={isPending || isSubmitting}
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
                        disabled={isPending || isSubmitting}
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
                        <span className="font-normal text-muted-foreground">
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
                        className="h-11 text-foreground"
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
            </FieldGroup>
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
            <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/80 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <div className="mx-auto flex w-full max-w-md flex-col gap-3 sm:max-w-none">
                <Button
                  type="submit"
                  size="lg"
                  disabled={
                    isPending ||
                    isSubmitting ||
                    (type === "transfer" && wallets.length < 2) ||
                    (type === "refund" && !walletId)
                  }
                  className={cn(
                    "min-h-12 w-full text-base",
                    type === "transfer" ? "h-auto" : "h-12",
                  )}
                >
                  {isSubmitting || isPending ? "Saving…" : label}
                </Button>
                <Link
                  to={cancelHref}
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
            disabled={isPending}
          />
        </footer>
      )}
    </form>
  );
}

interface DateChipProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function DateChip({ selected, onClick, children }: Readonly<DateChipProps>) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "h-11 px-4",
        selected &&
          "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10",
      )}
    >
      {children}
    </Button>
  );
}

interface WalletSelectProps {
  id: string;
  name: string;
  wallets: readonly WalletOption[];
  /** The form's value; "" means nothing chosen yet. */
  value: string;
  placeholder: string;
  onValueChange: (value: string) => void;
  onBlur: () => void;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
}

/** A wallet choice with its type, balance, and archived state in the list. */
function WalletSelect({
  id,
  name,
  wallets,
  value,
  placeholder,
  onValueChange,
  onBlur,
  ...aria
}: Readonly<WalletSelectProps>) {
  const byId = new Map(wallets.map((wallet) => [wallet.id, wallet]));
  return (
    <Select
      name={name}
      value={value || null}
      onValueChange={(next) => onValueChange(next ?? "")}
    >
      <SelectTrigger id={id} onBlur={onBlur} {...aria}>
        <SelectValue>
          {(selected: string | null) => {
            const wallet = selected ? byId.get(selected) : undefined;
            if (!wallet) {
              return (
                <span className="truncate text-muted-foreground">
                  {placeholder}
                </span>
              );
            }
            return (
              <>
                <WalletTypeIcon type={wallet.type} className="size-4" />
                <span className="truncate">{wallet.name}</span>
                {wallet.archived && (
                  <span className="shrink-0 text-muted-foreground">
                    · Archived
                  </span>
                )}
              </>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {wallets.map((wallet) => (
          <SelectItem
            key={wallet.id}
            value={wallet.id}
            label={wallet.name}
            className="min-h-14"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                <WalletTypeIcon type={wallet.type} className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">
                  {wallet.name}
                  {wallet.archived && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · Archived
                    </span>
                  )}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {WALLET_TYPE_LABELS[wallet.type]} ·{" "}
                  <span className="money" translate="no">
                    {wallet.balanceLabel}
                  </span>
                </span>
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
