import type { CalendarDate } from "@bookkeeping/domain/dates";
import { formatMoneyInput } from "@bookkeeping/domain/money";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import { useApiMutation } from "@/core/api/use-api-mutation";
import type { ApiFieldError } from "@/core/api/write-submission";
import { refreshAfterWrite } from "@/core/query/refresh-after-write";
import type { WalletFormInput } from "@/features/wallets/wallet-form-schema";
import { walletFormSchema } from "@/features/wallets/wallet-form-schema";

type CreateWalletRequest = components["schemas"]["CreateWalletRequest"];
type Wallet = components["schemas"]["Wallet"];

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
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | undefined>();
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string>
  >({});
  const createWallet = useApiMutation<CreateWalletRequest, Wallet>({
    send: (input, attempt) =>
      apiClient.POST("/v1/wallets", {
        params: { header: attempt.header },
        body: input,
      }),
    describeFieldError: describeWalletFieldError,
  });

  const defaultValues: WalletFormInput = {
    name: "",
    type: "cash",
    openingAmount: "",
    openingDate: defaultOpeningDate,
  };

  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: walletFormSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      setServerFieldErrors({});

      const parsed = walletFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }

      let result: Awaited<ReturnType<typeof createWallet.submit>>;
      try {
        result = await createWallet.submit({
          name: parsed.data.name,
          type: parsed.data.type,
          openingAmount: {
            value: formatMoneyInput({
              amountInMinorUnits: parsed.data.openingAmount,
              currency: "THB",
            }),
            currency: "THB",
          },
          openingDate: parsed.data.openingDate,
        });
      } catch {
        setServerError(
          "The wallet could not be saved. Check your connection and try again.",
        );
        return;
      }

      if (!result.ok) {
        setServerFieldErrors(result.error.fieldErrors);
        setServerError(result.error.message);
        return;
      }

      await refreshAfterWrite(queryClient);
      await navigate({
        to: "/wallets",
        search: { created: result.value.id },
      });
    },
  });

  return { form, serverError, serverFieldErrors };
}
