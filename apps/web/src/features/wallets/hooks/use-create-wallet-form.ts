import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { apiClient } from "@/core/api/client";
import { presentApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import { useFormWrites } from "@/core/api/use-form-writes";
import type { WalletFormInput } from "@/features/wallets/wallet-form-schema";
import { createWalletFormSchema } from "@/features/wallets/wallet-form-schema";
import { WALLET_REFUSAL_WORDING } from "@/features/wallets/wallet-rejection";
import { useToday } from "@/shared/hooks/use-today";

type CreateWalletRequest = components["schemas"]["CreateWalletRequest"];
type Wallet = components["schemas"]["Wallet"];

const WALLET_FORM_FIELDS = [
  "name",
  "type",
  "savings",
  "openingAmount",
  "openingDate",
] as const satisfies readonly (keyof WalletFormInput)[];

export function useCreateWalletForm() {
  const today = useToday();
  const schema = useMemo(() => createWalletFormSchema({ today }), [today]);
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
        ...WALLET_REFUSAL_WORDING,
        onDone: (created: Wallet) =>
          navigate({ to: "/wallets", search: { created: created.id } }),
      },
    },
  });

  const [defaultValues] = useState<WalletFormInput>(() => ({
    name: "",
    type: "cash",
    savings: false,
    openingAmount: "",
    openingDate: today,
  }));

  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: schema,
    },
    listeners: {
      onChange: ({ fieldApi }) => clearFieldError(fieldApi.name),
    },
    onSubmit: async ({ value }) => {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        return;
      }

      await submit("create", {
        name: parsed.data.name,
        type: parsed.data.type,
        savings: parsed.data.savings,
        openingAmount: presentApiMoney({
          amountInMinorUnits: parsed.data.openingAmount,
          currency: "THB",
        }),
        openingDate: parsed.data.openingDate,
      });
    },
  });

  return { form, today, serverError, serverFieldErrors: fieldErrors };
}
