import type { TransactionType } from "@bookkeeping/domain/transactions";
import { Link } from "@tanstack/react-router";
import { ArrowDownUp } from "lucide-react";
import { WalletSelect } from "@/features/transactions/components/transaction-form-fields";
import type { WalletOption } from "@/features/transactions/transaction.types";
import { FieldErrors } from "@/shared/components/form/field-errors";
import { Button, linkActionClass } from "@/shared/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/shared/components/ui/field";

// The capture form's wallet fields: where the money leaves from or lands in,
// and a transfer's destination. `TransactionForm` wires them to its form.

interface WalletFieldProps {
  name: string;
  wallets: readonly WalletOption[];
  /** The form's value; "" means nothing chosen yet. */
  value: string;
  onBlur: () => void;
  onChange: (walletId: string) => void;
  isValid: boolean;
  errors: React.ComponentProps<typeof FieldErrors>["errors"];
  serverError: string | undefined;
}

interface ArchivedWallet {
  id: string;
  name: string;
}

interface SourceWalletFieldProps extends WalletFieldProps {
  type: TransactionType;
  /** A refund's original wallet, when it is archived and so can't be chosen. */
  archivedWallet: ArchivedWallet | undefined;
  onSwap: () => void;
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

export function SourceWalletField({
  name,
  wallets,
  value,
  onBlur,
  onChange,
  isValid,
  errors,
  serverError,
  type,
  archivedWallet,
  onSwap,
}: Readonly<SourceWalletFieldProps>) {
  const invalid = !isValid || Boolean(serverError);
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={name}>{walletLabelFor(type)}</FieldLabel>
      <div className="flex items-center gap-2">
        <WalletSelect
          id={name}
          name={name}
          wallets={wallets}
          value={value}
          placeholder={
            type === "refund" ? "Choose an active wallet" : "Choose a wallet"
          }
          onBlur={onBlur}
          onValueChange={onChange}
          aria-invalid={invalid}
          aria-describedby={
            [
              archivedWallet && "walletId-description",
              invalid && `${name}-error`,
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
            onClick={onSwap}
          >
            <ArrowDownUp aria-hidden="true" strokeWidth={1.75} />
          </Button>
        )}
      </div>
      {archivedWallet && (
        <>
          <FieldDescription id="walletId-description">
            {archivedWallet.name}, the expense’s wallet, is archived. Choose an
            active wallet.
          </FieldDescription>
          <Link
            to="/wallets/$walletId/manage"
            params={{ walletId: archivedWallet.id }}
            className={linkActionClass}
          >
            Unarchive {archivedWallet.name}
          </Link>
        </>
      )}
      <FieldErrors
        id={`${name}-error`}
        serverError={serverError}
        errors={errors}
      />
    </Field>
  );
}

export function DestinationWalletField({
  name,
  wallets,
  value,
  onBlur,
  onChange,
  isValid,
  errors,
  serverError,
}: Readonly<WalletFieldProps>) {
  const invalid = !isValid || Boolean(serverError);
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={name}>To</FieldLabel>
      <WalletSelect
        id={name}
        name={name}
        wallets={wallets}
        value={value}
        placeholder="Choose a destination wallet"
        onBlur={onBlur}
        onValueChange={onChange}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${name}-error` : "transfer-description"}
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
        <Link to="/wallets/new" className={linkActionClass}>
          Create another wallet
        </Link>
      )}
      <FieldErrors
        id={`${name}-error`}
        serverError={serverError}
        errors={errors}
      />
    </Field>
  );
}
