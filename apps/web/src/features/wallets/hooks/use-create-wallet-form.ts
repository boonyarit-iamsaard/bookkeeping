import type { CalendarDate } from "@bookkeeping/domain/dates";
import { formatMoneyInput } from "@bookkeeping/domain/money";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import { useFormWrites } from "@/core/api/use-form-writes";
import type { ApiFieldError } from "@/core/api/write-submission";
import type { WalletFormInput } from "@/features/wallets/wallet-form-schema";
import { walletFormSchema } from "@/features/wallets/wallet-form-schema";

type CreateWalletRequest = components["schemas"]["CreateWalletRequest"];
type Wallet = components["schemas"]["Wallet"];

const WALLET_FORM_FIELDS = [
  "name",
  "type",
  "savings",
  "openingAmount",
  "openingDate",
] as const satisfies readonly (keyof WalletFormInput)[];

interface UseCreateWalletFormOptions {
  defaultOpeningDate: CalendarDate;
}

const FIELD_ERROR_MESSAGES: Record<string, string> = {
  empty: "Enter a wallet name",
  "invalid-format": "Enter a valid value",
  "too-many-decimals": "Use at most two decimals; satang is the smallest unit",
  "out-of-range": "That amount is larger than the app can store",
  "in-future": "Opening date cannot be in the future",
};

function describeWalletFieldError({
  code,
  detail,
}: Readonly<ApiFieldError>): string {
  return detail ?? FIELD_ERROR_MESSAGES[code] ?? "This value was not accepted.";
}

export function useCreateWalletForm({
  defaultOpeningDate,
}: Readonly<UseCreateWalletFormOptions>) {
  const navigate = useNavigate();
  const { submit, serverError, fieldErrors, clearFieldError } = useFormWrites({
    fields: WALLET_FORM_FIELDS,
    writes: {
      create: {
        kind: "create",
        send: (input: CreateWalletRequest, attempt) =>
          apiClient.POST("/v1/wallets", {
            params: { header: attempt.header },
            body: input,
          }),
        describeFieldError: describeWalletFieldError,
        onDone: (created: Wallet) =>
          navigate({ to: "/wallets", search: { created: created.id } }),
      },
    },
  });

  const defaultValues: WalletFormInput = {
    name: "",
    type: "cash",
    savings: false,
    openingAmount: "",
    openingDate: defaultOpeningDate,
  };

  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: walletFormSchema,
    },
    listeners: {
      onChange: ({ fieldApi }) => clearFieldError(fieldApi.name),
    },
    onSubmit: async ({ value }) => {
      const parsed = walletFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }

      await submit.create({
        name: parsed.data.name,
        type: parsed.data.type,
        savings: parsed.data.savings,
        openingAmount: {
          value: formatMoneyInput({
            amountInMinorUnits: parsed.data.openingAmount,
            currency: "THB",
          }),
          currency: "THB",
        },
        openingDate: parsed.data.openingDate,
      });
    },
  });

  return { form, serverError, serverFieldErrors: fieldErrors };
}
