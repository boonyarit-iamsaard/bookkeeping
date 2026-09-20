"use client";

import type { CalendarDate } from "@bookkeeping/domain/dates";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createWalletAction } from "@/features/wallets/server/wallet.actions";
import type { WalletFormInput } from "@/features/wallets/wallet-form-schema";
import { walletFormSchema } from "@/features/wallets/wallet-form-schema";

interface UseCreateWalletFormOptions {
  defaultOpeningDate: CalendarDate;
}

export function useCreateWalletForm({
  defaultOpeningDate,
}: Readonly<UseCreateWalletFormOptions>) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

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
      setServerError(null);

      let result: Awaited<ReturnType<typeof createWalletAction>>;
      try {
        // Each submission is its own creation; the key only guards the
        // operation against a duplicated request, not a repeated submit.
        result = await createWalletAction({
          ...value,
          submissionKey: crypto.randomUUID(),
        });
      } catch {
        setServerError(
          "The wallet could not be saved. Check your connection and try again.",
        );
        return;
      }

      if (!result.ok) {
        if (result.error === "unauthenticated") {
          router.push("/sign-in");
          return;
        }
        setServerError(
          "Some details were not accepted. Check the fields and try again.",
        );
        return;
      }

      router.push(`/wallets?created=${encodeURIComponent(result.value.id)}`);
      router.refresh();
    },
  });

  return { form, serverError };
}
