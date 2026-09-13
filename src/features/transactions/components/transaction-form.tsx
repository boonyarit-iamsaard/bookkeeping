"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CategoryPicker } from "@/features/categories/components/category-picker";
import type { CreateCategoryActionSuccess } from "@/features/categories/server/actions";
import { useBangkokToday } from "@/features/transactions/hooks/use-bangkok-today";
import type {
  CategoryOption,
  WalletOption,
} from "@/features/transactions/hooks/use-transaction-form";
import { useTransactionForm } from "@/features/transactions/hooks/use-transaction-form";
import { MAX_NOTE_LENGTH } from "@/features/transactions/money-limits";
import type { TransactionType } from "@/features/transactions/transaction-types";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_SIGNS,
  TRANSACTION_TYPES,
} from "@/features/transactions/transaction-types";
import { WALLET_TYPE_LABELS } from "@/features/wallets/wallet-types";
import { FieldErrors } from "@/shared/components/form/field-errors";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { NativeSelect } from "@/shared/components/ui/native-select";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { cn } from "@/shared/helpers/cn";
import type { CalendarDate } from "@/shared/helpers/dates";
import { addDays } from "@/shared/helpers/dates";
import { formatMoney, parseMoneyInput } from "@/shared/helpers/money";

const TYPE_OPTIONS = TRANSACTION_TYPES.map((value) => ({
  value,
  label: TRANSACTION_TYPE_LABELS[value],
}));

interface TransactionFormProps {
  wallets: readonly WalletOption[];
  categories: readonly CategoryOption[];
  /** Today in Asia/Bangkok, computed on the server. */
  today: CalendarDate;
  defaultWalletId: string;
}

/** "Save −฿120.00 · Cash" once the amount parses; plain "Save" before that. */
function SaveLabel({
  type,
  amountText,
  walletName,
}: Readonly<{
  type: TransactionType;
  amountText: string;
  walletName: string | undefined;
}>) {
  const parsed = parseMoneyInput({ text: amountText, currency: "THB" });
  if (!parsed.ok || parsed.value <= 0n || !walletName) {
    return "Save";
  }
  const figure = formatMoney({
    amountInMinorUnits: parsed.value,
    currency: "THB",
  });
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

export function TransactionForm({
  wallets,
  categories: initialCategories,
  today: initialToday,
  defaultWalletId,
}: Readonly<TransactionFormProps>) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  // Categories saved from the panel join the list at once; they are already
  // committed, so cancelling the transaction cannot lose them.
  const [categories, setCategories] = useState(initialCategories);
  function addCategories({
    category,
    createdParent,
  }: Readonly<CreateCategoryActionSuccess>) {
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
    function cancelOnEscape(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        event.target instanceof Node &&
        element?.contains(event.target)
      ) {
        event.preventDefault();
        router.push("/transactions");
      }
    }
    document.addEventListener("keydown", cancelOnEscape);
    return () => document.removeEventListener("keydown", cancelOnEscape);
  }, [router]);
  const {
    form,
    notice,
    fieldErrors,
    clearFieldError,
    changeType,
    awaitingReplay,
  } = useTransactionForm({
    wallets,
    categories,
    today: initialToday,
    defaultWalletId,
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
      {notice?.kind === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm"
        >
          {notice.message}
        </div>
      )}
      {notice?.kind === "uncertain" && (
        <output className="rounded-xl border bg-muted px-4 py-3 text-sm leading-normal">
          <span className="block font-medium">
            The response to your last save was lost.
          </span>
          <span className="mt-1 block text-muted-foreground">
            It may already be recorded. Retry to check the same entry; nothing
            will be saved twice, and the fields stay locked until then.
          </span>
        </output>
      )}

      <fieldset disabled={awaitingReplay} className="contents">
        <FieldGroup>
          <form.Field name="amount">
            {(field) => {
              const serverError = fieldErrors.amount;
              const invalid = !field.state.meta.isValid || Boolean(serverError);
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
                      autoFocus
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
                    In Thai baht, to the satang.
                  </FieldDescription>
                  <FieldErrors
                    id={`${field.name}-error`}
                    serverError={serverError}
                    errors={field.state.meta.errors}
                  />
                </Field>
              );
            }}
          </form.Field>

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

          <form.Field name="walletId">
            {(field) => {
              const serverError = fieldErrors.walletId;
              const invalid = !field.state.meta.isValid || Boolean(serverError);
              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Wallet</FieldLabel>
                  <NativeSelect
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      clearFieldError("walletId");
                      clearFieldError("transactionDate");
                      field.handleChange(event.target.value);
                    }}
                    aria-invalid={invalid}
                    aria-describedby={
                      invalid ? `${field.name}-error` : undefined
                    }
                  >
                    {wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name} · {WALLET_TYPE_LABELS[wallet.type]} ·{" "}
                        {wallet.balanceLabel}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldErrors
                    id={`${field.name}-error`}
                    serverError={serverError}
                    errors={field.state.meta.errors}
                  />
                </Field>
              );
            }}
          </form.Field>

          <form.Subscribe selector={(state) => state.values.type}>
            {(type) => (
              <form.Field name="categoryId">
                {(field) => {
                  const serverError = fieldErrors.categoryId;
                  const invalid =
                    !field.state.meta.isValid || Boolean(serverError);
                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel id="categoryId-label" htmlFor={field.name}>
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
                        disabled={awaitingReplay}
                      />
                      <FieldErrors
                        id={`${field.name}-error`}
                        serverError={serverError}
                        errors={field.state.meta.errors}
                      />
                    </Field>
                  );
                }}
              </form.Field>
            )}
          </form.Subscribe>

          <form.Field name="transactionDate">
            {(field) => {
              const serverError = fieldErrors.transactionDate;
              const invalid = !field.state.meta.isValid || Boolean(serverError);
              function pick(date: CalendarDate) {
                clearFieldError("transactionDate");
                field.handleChange(date);
              }
              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Date</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="date"
                    max={today}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => pick(event.target.value)}
                    aria-invalid={invalid}
                    aria-describedby={
                      invalid ? `${field.name}-error` : undefined
                    }
                    className="h-11 text-foreground"
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
                    serverError={serverError}
                    errors={field.state.meta.errors}
                  />
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="note">
            {(field) => {
              const serverError = fieldErrors.note;
              const invalid = !field.state.meta.isValid || Boolean(serverError);
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
                    id={`${field.name}-error`}
                    serverError={serverError}
                    errors={field.state.meta.errors}
                  />
                </Field>
              );
            }}
          </form.Field>
        </FieldGroup>
      </fieldset>

      <form.Subscribe
        selector={(state) => ({
          isSubmitting: state.isSubmitting,
          type: state.values.type,
          amount: state.values.amount,
          walletId: state.values.walletId,
        })}
      >
        {({ isSubmitting, type, amount, walletId }) => {
          const walletName = wallets.find((w) => w.id === walletId)?.name;
          let label: React.ReactNode = (
            <SaveLabel
              type={type}
              amountText={amount}
              walletName={walletName}
            />
          );
          if (isSubmitting) {
            label = "Saving…";
          } else if (awaitingReplay) {
            label = "Check and retry save";
          }
          return (
            <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/80 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <div className="mx-auto flex w-full max-w-md flex-col gap-3 sm:max-w-none">
                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="h-12 w-full text-base"
                >
                  {label}
                </Button>
                <Link
                  href="/transactions"
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
