import { retryProvisioningAction } from "@/features/auth/server/provisioning.actions";

/**
 * Completes an interrupted provisioning right after sign-in or sign-up. The
 * account is usable either way, so a failure here is not surfaced and does
 * not hold up the redirect; the next sign-in retries.
 */
export async function completeProvisioning(): Promise<void> {
  try {
    const result = await retryProvisioningAction();
    if (!result.ok) {
      reportProvisioningFailure(result.error);
    }
  } catch (error: unknown) {
    reportProvisioningFailure(error);
  }
}

function reportProvisioningFailure(error: unknown) {
  console.error("Fresh-user provisioning retry failed", { error });
}
