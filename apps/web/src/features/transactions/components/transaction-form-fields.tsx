import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { formatMoney, parseMoneyInput } from "@bookkeeping/domain/money";
import type { TransactionType } from "@bookkeeping/domain/transactions";
import { Link } from "@tanstack/react-router";
import { Check, ChevronRight } from "lucide-react";
import {
  CategoryIcon,
  CategoryTile,
} from "@/features/categories/components/category-icon";
import { useCategoryColors } from "@/features/categories/hooks/use-category-colors";
import type { WalletOption } from "@/features/transactions/hooks/use-transaction-form";
import type { LinkedExpenseView } from "@/features/transactions/transaction.types";
import { TRANSACTION_TYPE_SIGNS } from "@/features/transactions/transaction-labels";
import { WalletTypeIcon } from "@/features/wallets/components/wallet-type-icon";
import { WALLET_TYPE_LABELS } from "@/features/wallets/wallet-labels";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { FieldGroup } from "@/shared/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/helpers/cn";

// The capture form's pieces: its cards, fixed labels, chips, wallet choice,
// and the readbacks of what Save will record and which expense a refund
// returns. Only `TransactionForm` composes them.

interface SaveLabelProps {
  type: TransactionType;
  amountText: string;
  walletName: string | undefined;
  destinationWalletName?: string;
}

/** "Save −฿120.00 · Cash" once the amount parses; plain "Save" before that. */
export function SaveLabel({
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
        <span className="w-full text-sm font-normal wrap-break-word whitespace-normal">
          {walletName} → {destinationWalletName}
        </span>
      </span>
    );
  }
  // A long wallet name gives way so the figure always shows in full.
  return (
    <span className="flex min-w-0">
      <span className="shrink-0 whitespace-pre">
        Save{" "}
        <span className="money" translate="no">
          {TRANSACTION_TYPE_SIGNS[type]}
          {figure}
        </span>{" "}
        ·{" "}
      </span>
      <span className="min-w-0 truncate">{walletName}</span>
    </span>
  );
}

interface FormCardProps {
  children: React.ReactNode;
}

/** One group of fields on a card over the ground. */
export function FormCard({ children }: Readonly<FormCardProps>) {
  return (
    <Card className="px-5 sm:px-7 sm:py-7">
      <FieldGroup>{children}</FieldGroup>
    </Card>
  );
}

interface FixedLabelProps {
  children: React.ReactNode;
}

export function FixedLabel({ children }: Readonly<FixedLabelProps>) {
  return (
    <span
      data-slot="field-label"
      className="flex items-center gap-2 text-sm leading-none font-medium select-none"
    >
      {children}
    </span>
  );
}

interface LinkedExpenseChipProps {
  expense: LinkedExpenseView;
}

/** The refunded expense read back: category, date, amount, and what is left. */
export function LinkedExpenseChip({
  expense,
}: Readonly<LinkedExpenseChipProps>) {
  const colorOf = useCategoryColors();
  return (
    <Link
      to="/transactions/$transactionId"
      params={{ transactionId: expense.id }}
      aria-label={`Refund of ${expense.categoryLabel}, ${expense.amountLabel} on ${formatCalendarDate(expense.transactionDate)}, ${expense.refundAllowanceLabel} left to refund. Open the expense.`}
      className="bg-muted hover:bg-accent focus-visible:ring-ring/45 flex min-h-16 min-w-0 items-center gap-3.5 rounded-xl px-3 py-2.5 transition-colors duration-150 outline-none focus-visible:ring-[3px] motion-reduce:transition-none"
    >
      <CategoryTile
        color={expense.categoryId ? colorOf(expense.categoryId) : "neutral"}
      >
        <CategoryIcon iconId={expense.categoryIconId} />
      </CategoryTile>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="block text-base leading-snug font-semibold wrap-break-word">
          <span className="text-muted-foreground font-normal">Refund of</span>{" "}
          {expense.categoryLabel}
        </span>
        <span className="text-muted-foreground block text-sm wrap-break-word">
          <span className="money" translate="no">
            −{expense.amountLabel}
          </span>{" "}
          ·{" "}
          <span className="whitespace-nowrap">
            {formatCalendarDate(expense.transactionDate)}
          </span>
        </span>
        <span className="text-secondary-foreground block text-sm font-semibold">
          <span className="money" translate="no">
            {expense.refundAllowanceLabel}
          </span>{" "}
          left to refund
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        strokeWidth={1.75}
        className="text-muted-foreground size-4 shrink-0"
      />
    </Link>
  );
}

interface DateChipProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function DateChip({
  selected,
  onClick,
  children,
}: Readonly<DateChipProps>) {
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
          "bg-secondary text-secondary-foreground hover:bg-secondary border-transparent",
      )}
    >
      {selected && <Check aria-hidden="true" strokeWidth={2.25} />}
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
export function WalletSelect({
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
                <span className="text-muted-foreground truncate">
                  {placeholder}
                </span>
              );
            }
            return (
              <>
                <WalletTypeIcon type={wallet.type} className="size-4" />
                <span className="truncate">{wallet.name}</span>
                {wallet.archived && (
                  <span className="text-muted-foreground shrink-0">
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
              <span className="bg-muted text-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
                <WalletTypeIcon type={wallet.type} className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">
                  {wallet.name}
                  {wallet.archived && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · Archived
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground truncate text-xs">
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
