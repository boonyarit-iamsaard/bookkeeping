import type { CalendarDate } from "@bookkeeping/domain/dates";
import { formatMoneyInput } from "@bookkeeping/domain/money";
import type { TransactionType } from "@bookkeeping/domain/transactions";
import {
  carriesOwnCategory,
  carriesOwnTags,
} from "@bookkeeping/domain/transactions";
import { presentApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import type { CaptureOrigin } from "@/features/transactions/capture-origin";
import { captureOriginHref } from "@/features/transactions/capture-origin";
import type {
  CategoryOption,
  EditableTransaction,
  LinkedExpenseView,
  WalletOption,
} from "@/features/transactions/transaction.types";
import type {
  LinkedExpenseLimits,
  TransactionFormInput,
  TransactionFormValues,
} from "@/features/transactions/transaction-form-schema";

/** How the entry form was opened: to record, to record a Refund, or to correct. */
export type EntryMode =
  | {
      kind: "record";
      defaultWalletId: string;
      captureOrigin: CaptureOrigin;
    }
  /** A new refund of one expense; the wallet is unset when the original is archived. */
  | { kind: "refund"; expense: LinkedExpenseView; defaultWalletId: string }
  | { kind: "correct"; transaction: EditableTransaction };

/** Everything the entry form shows, constrains, and sends for one mode. */
export interface TransactionEntry {
  initialValues: TransactionFormInput;
  /** The limits the form hints check inline for a linked refund. */
  limits?: LinkedExpenseLimits;
  /** Set when the type cannot be picked: a refund, or any correction. */
  fixedType?: TransactionType;
  /** Set when the entry records or corrects a refund of this expense. */
  linkedExpense?: LinkedExpenseView;
  cancelHref: string;
  /** Set only for a new record that returns to its opening screen. */
  captureOrigin?: CaptureOrigin;
  /** Set when the entry corrects a saved transaction in place. */
  correcting?: EditableTransaction;
}

interface OpenEntryOptions {
  mode: EntryMode;
  categories: readonly CategoryOption[];
  /** Today in Asia/Bangkok when the form first opened. */
  today: CalendarDate;
}

/** The kind's protected Uncategorized, else its first category. */
export function uncategorizedFor(
  categories: readonly CategoryOption[],
  type: TransactionType,
): string {
  return (
    categories.find(
      (category) => category.kind === type && category.isProtected,
    )?.id ??
    categories.find((category) => category.kind === type)?.id ??
    ""
  );
}

function limitsOf(expense: Readonly<LinkedExpenseView>): LinkedExpenseLimits {
  return {
    transactionDate: expense.transactionDate,
    refundAllowance: expense.refundAllowance,
  };
}

interface OpenRecordOptions extends Omit<OpenEntryOptions, "mode"> {
  mode: Extract<EntryMode, { kind: "record" }>;
}

function openRecord({
  mode,
  categories,
  today,
}: Readonly<OpenRecordOptions>): TransactionEntry {
  return {
    initialValues: {
      type: "expense",
      currency: "THB",
      destinationWalletId: "",
      refundOfTransactionId: "",
      walletId: mode.defaultWalletId,
      categoryId: uncategorizedFor(categories, "expense"),
      amount: "",
      transactionDate: today,
      note: "",
      tagIds: [],
    },
    cancelHref: captureOriginHref(mode.captureOrigin),
    captureOrigin: mode.captureOrigin,
  };
}

function openRefund(
  mode: Readonly<Extract<EntryMode, { kind: "refund" }>>,
  today: CalendarDate,
): TransactionEntry {
  const { expense } = mode;
  return {
    initialValues: {
      type: "refund",
      currency: "THB",
      destinationWalletId: "",
      refundOfTransactionId: expense.id,
      walletId: mode.defaultWalletId,
      categoryId: "",
      // A refund most often returns everything still left on its expense.
      amount: formatMoneyInput({
        amountInMinorUnits: expense.refundAllowance,
        currency: "THB",
      }),
      transactionDate: today,
      note: "",
      tagIds: [],
    },
    limits: limitsOf(expense),
    fixedType: "refund",
    linkedExpense: expense,
    cancelHref: `/transactions/${expense.id}`,
  };
}

function openCorrection(
  transaction: Readonly<EditableTransaction>,
): TransactionEntry {
  const { refundOf } = transaction;
  return {
    initialValues: {
      type: transaction.type,
      currency: "THB",
      destinationWalletId: transaction.destinationWalletId,
      refundOfTransactionId: refundOf?.id ?? "",
      walletId: transaction.walletId,
      categoryId: transaction.categoryId,
      amount: transaction.amountText,
      transactionDate: transaction.transactionDate,
      note: transaction.note,
      tagIds: [...transaction.tagIds],
    },
    limits: refundOf ? limitsOf(refundOf) : undefined,
    fixedType: transaction.type,
    linkedExpense: refundOf,
    cancelHref: `/transactions/${transaction.id}`,
    correcting: transaction,
  };
}

/** Opens the entry form for one mode over the facts the route loaded. */
export function openEntry({
  mode,
  categories,
  today,
}: Readonly<OpenEntryOptions>): TransactionEntry {
  if (mode.kind === "correct") {
    return openCorrection(mode.transaction);
  }
  if (mode.kind === "refund") {
    return openRefund(mode, today);
  }
  return openRecord({ mode, categories, today });
}

type CreateTransactionRequest =
  components["schemas"]["CreateTransactionRequest"];
type UpdateTransactionRequest =
  components["schemas"]["UpdateTransactionRequest"];

/** What a submit sends: a new transaction, or a correction of a saved one. */
export type EntryRequest =
  | { kind: "create"; request: CreateTransactionRequest }
  | {
      kind: "update";
      transactionId: string;
      request: UpdateTransactionRequest;
    };

function wireFieldsOf(values: Readonly<TransactionFormValues>) {
  return {
    amount: presentApiMoney({
      amountInMinorUnits: values.amount,
      currency: values.currency,
    }),
    walletId: values.walletId,
    transactionDate: values.transactionDate,
    note: values.note,
  };
}

function createRequestOf(
  values: Readonly<TransactionFormValues>,
): CreateTransactionRequest {
  const common = wireFieldsOf(values);
  if (carriesOwnCategory(values)) {
    return {
      ...common,
      type: values.type,
      categoryId: values.categoryId,
      // Untagged entries send exactly what they sent before tags existed.
      ...(carriesOwnTags(values) && values.tagIds.length > 0
        ? { tagIds: [...values.tagIds] }
        : {}),
    };
  }
  if (values.type === "transfer") {
    return {
      ...common,
      type: values.type,
      destinationWalletId: values.destinationWalletId,
    };
  }
  return {
    ...common,
    type: "refund",
    refundOfTransactionId: values.refundOfTransactionId,
  };
}

/**
 * A correction carries every field but the type and the expense link, which
 * are fixed, and names every tag it keeps: an empty list removes them.
 */
function updateRequestOf(
  values: Readonly<TransactionFormValues>,
): UpdateTransactionRequest {
  return {
    ...wireFieldsOf(values),
    ...(carriesOwnCategory(values) ? { categoryId: values.categoryId } : {}),
    ...(values.type === "transfer"
      ? { destinationWalletId: values.destinationWalletId }
      : {}),
    tagIds: carriesOwnTags(values) ? [...values.tagIds] : [],
  };
}

/** The request a submit of the entry's parsed values sends. */
export function entryRequest(
  entry: Readonly<TransactionEntry>,
  values: Readonly<TransactionFormValues>,
): EntryRequest {
  if (entry.correcting) {
    return {
      kind: "update",
      transactionId: entry.correcting.id,
      request: updateRequestOf(values),
    };
  }
  return { kind: "create", request: createRequestOf(values) };
}

interface ValuesForTypeOptions {
  values: Readonly<TransactionFormInput>;
  type: TransactionType;
  wallets: readonly Pick<WalletOption, "id">[];
  categories: readonly CategoryOption[];
}

/** The fields a type switch sets; an absent field keeps its value. */
export interface TypeSwitch {
  type: TransactionType;
  categoryId?: string;
  tagIds?: string[];
  destinationWalletId?: string;
}

/**
 * The fields a type switch changes: a type without its own category or tags
 * drops them, a category of the wrong kind becomes Uncategorized, and only a
 * transfer keeps a destination.
 */
export function valuesForType({
  values,
  type,
  wallets,
  categories,
}: Readonly<ValuesForTypeOptions>): TypeSwitch {
  const patch: TypeSwitch = { type };
  if (carriesOwnCategory({ type })) {
    const current = categories.find(
      (category) => category.id === values.categoryId,
    );
    if (current?.kind !== type) {
      patch.categoryId = uncategorizedFor(categories, type);
    }
  } else {
    patch.categoryId = "";
  }
  if (!carriesOwnTags({ type })) {
    patch.tagIds = [];
  }
  if (type !== "transfer") {
    patch.destinationWalletId = "";
  } else if (!values.destinationWalletId) {
    patch.destinationWalletId =
      wallets.find((wallet) => wallet.id !== values.walletId)?.id ?? "";
  }
  return patch;
}
